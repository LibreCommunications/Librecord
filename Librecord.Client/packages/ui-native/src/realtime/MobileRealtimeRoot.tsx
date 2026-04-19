import { useContext, useEffect, useRef } from "react";
import {
    appConnection,
    dispatchAppEvent,
    getEventBus,
    setConnectionState,
} from "@librecord/api-client";
import { AuthContext } from "@librecord/app/context";
import {
    logger,
    invalidate,
    mapGuildRealtimeToMessage,
    mapGuildRealtimeEdit,
    mapDmRealtimeToMessage,
    mapDmRealtimeEdit,
} from "@librecord/domain";
import type {
    AppEventMap,
    GuildRealtimeMessageTransport,
    GuildRealtimeMessageEditedTransport,
    GuildRealtimeMessageDeletedTransport,
    DmRealtimeMessageTransport,
    DmRealtimeMessageEditedTransport,
    DmRealtimeMessageDeletedTransport,
} from "@librecord/domain";

// Module-level — survives component re-mounts (e.g. navigation container
// transitions). Matches the pattern in @librecord/app/realtime/RealtimeRoot.
let started = false;

/**
 * Mobile equivalent of @librecord/app/realtime/RealtimeRoot. The web root
 * imports livekit-client and react-native-sound analogues; we can't share it
 * verbatim on RN. This version starts the SignalR connection and wires the
 * non-voice subset of hub events. Voice wiring arrives when LiveKit's RN SDK
 * lands.
 *
 * Mount this inside AuthProvider — it watches for a logged-in user and
 * starts/stops the connection accordingly.
 */
export function MobileRealtimeRoot() {
    const { user } = useContext(AuthContext);
    const userIdRef = useRef<string | null>(null);

    // Start/restart the hub connection when the user becomes authenticated.
    useEffect(() => {
        if (!user?.userId || started) return;
        started = true;
        userIdRef.current = user.userId;

        setConnectionState("connecting");
        appConnection.start()
            .then(() => {
                registerCoreListeners();
                initCacheInvalidation();
                setConnectionState("connected");
                getEventBus()?.dispatchPlain("realtime:ready");
            })
            .catch((err) => {
                logger.realtime.error("Connection failed", err);
                setConnectionState("disconnected");
            });
    });

    // Tear down when the user logs out.
    useEffect(() => {
        if (user?.userId) {
            userIdRef.current = user.userId;
            return;
        }
        if (!user && userIdRef.current) {
            userIdRef.current = null;
            started = false;
            appConnection.stop().catch((e) => logger.realtime.warn("Connection stop failed", e));
        }
    }, [user]);

    return null;
}

/**
 * Non-voice SignalR listeners. Mirrors the relevant blocks from
 * @librecord/app/realtime/listeners.ts so shared UI code can subscribe to
 * the same AppEventMap keys on both platforms.
 */
function registerCoreListeners() {
    // Re-register-safe: clear existing handlers first (reconnect paths re-enter here).
    const offEvents = [
        "guild:message:ping",
        "guild:message:new",
        "guild:message:edited",
        "guild:message:deleted",
        "guild:updated",
        "guild:deleted",
        "guild:channel:created",
        "guild:channel:updated",
        "guild:channel:deleted",
        "guild:member:added",
        "guild:member:removed",
        "guild:member:roles",
        "dm:message:new",
        "dm:message:edited",
        "dm:message:deleted",
        "dm:channel:created",
        "dm:channel:deleted",
        "dm:member:added",
        "dm:member:left",
        "dm:user:presence",
        "dm:readstate:updated",
        "dm:leave:ack",
        "friend:request:received",
        "friend:request:accepted",
        "friend:request:declined",
        "friend:removed",
    ] as const;
    for (const evt of offEvents) appConnection.off(evt);

    const forward = <K extends keyof AppEventMap>(evt: K) =>
        appConnection.on(evt, (payload: AppEventMap[K]) => dispatchAppEvent(evt, payload));

    // Guild message events need the transport → Message transform.
    appConnection.on("guild:message:ping", (payload: AppEventMap["guild:message:ping"]) => {
        dispatchAppEvent("guild:message:ping", payload);
    });
    appConnection.on("guild:message:new", (payload: GuildRealtimeMessageTransport) => {
        dispatchAppEvent("guild:message:new", {
            message: mapGuildRealtimeToMessage(payload),
            clientMessageId: payload.clientMessageId,
        });
    });
    appConnection.on("guild:message:edited", (payload: GuildRealtimeMessageEditedTransport) => {
        dispatchAppEvent("guild:message:edited", mapGuildRealtimeEdit(payload));
    });
    appConnection.on("guild:message:deleted", (payload: GuildRealtimeMessageDeletedTransport) => {
        dispatchAppEvent("guild:message:deleted", payload);
    });

    // DM message events use the parallel DM transforms.
    appConnection.on("dm:message:new", (payload: DmRealtimeMessageTransport) => {
        dispatchAppEvent("dm:message:new", {
            message: mapDmRealtimeToMessage(payload),
            clientMessageId: payload.clientMessageId,
        });
    });
    appConnection.on("dm:message:edited", (payload: DmRealtimeMessageEditedTransport) => {
        dispatchAppEvent("dm:message:edited", mapDmRealtimeEdit(payload));
    });
    appConnection.on("dm:message:deleted", (payload: DmRealtimeMessageDeletedTransport) => {
        dispatchAppEvent("dm:message:deleted", payload);
    });

    // A brand-new DM channel: subscribe to its SignalR group so we get its
    // future message events, then forward the notification to the UI.
    appConnection.on("dm:channel:created", (payload: AppEventMap["dm:channel:created"]) => {
        appConnection.invoke("JoinDmChannel", payload.channelId).catch((err) => {
            logger.realtime.warn("Failed to join new DM channel group", err);
        });
        dispatchAppEvent("dm:channel:created", payload);
    });

    // Server tells us we've been removed from a DM; drop the group subscription.
    appConnection.on("dm:leave:ack", (payload: { channelId: string }) => {
        appConnection.invoke("LeaveDmChannel", payload.channelId).catch((e) =>
            logger.realtime.warn("Failed to leave DM channel group", e),
        );
    });

    // A brand-new guild channel: subscribe to it.
    appConnection.on("guild:channel:created", (payload: AppEventMap["guild:channel:created"]) => {
        appConnection.invoke("JoinGuildChannel", payload.channelId).catch((err) => {
            logger.realtime.warn("Failed to join new guild channel group", err);
        });
        dispatchAppEvent("guild:channel:created", payload);
    });

    forward("guild:updated");
    forward("guild:deleted");
    forward("guild:channel:updated");
    forward("guild:channel:deleted");
    forward("guild:member:added");
    forward("guild:member:removed");
    forward("guild:member:roles");
    forward("dm:channel:deleted");
    forward("dm:member:added");
    forward("dm:member:left");
    forward("dm:user:presence");
    forward("dm:readstate:updated");
    forward("friend:request:received");
    forward("friend:request:accepted");
    forward("friend:request:declined");
    forward("friend:removed");
}

/**
 * Mirror of @librecord/app/cacheInvalidation.ts but scoped to the events we
 * actually wire on mobile. We can't import the shared file directly via the
 * package exports map; short-term duplication, will reconcile when the shared
 * realtime layer gets a proper core/voice split.
 */
function initCacheInvalidation() {
    const bus = getEventBus();
    if (!bus) return;

    bus.on<AppEventMap["guild:updated"]>("guild:updated", (d) => {
        invalidate("guilds");
        invalidate(`guild:${d.guildId}`);
    });
    bus.on<AppEventMap["guild:deleted"]>("guild:deleted", (d) => {
        invalidate("guilds");
        invalidate(`guild:${d.guildId}*`);
    });
    bus.on<AppEventMap["guild:channel:created"]>("guild:channel:created", (d) => {
        invalidate(`guild:${d.guildId}:channels`);
    });
    bus.on<AppEventMap["guild:channel:updated"]>("guild:channel:updated", (d) => {
        invalidate(`guild:${d.guildId}:channels`);
        invalidate(`channel:${d.channelId}`);
    });
    bus.on<AppEventMap["guild:channel:deleted"]>("guild:channel:deleted", (d) => {
        invalidate(`guild:${d.guildId}:channels`);
        invalidate(`channel:${d.channelId}`);
    });
    bus.on<AppEventMap["guild:member:added"]>("guild:member:added", (d) => {
        invalidate(`guild:${d.guildId}:members`);
    });
    bus.on<AppEventMap["guild:member:removed"]>("guild:member:removed", (d) => {
        invalidate(`guild:${d.guildId}:members`);
    });
    bus.on<AppEventMap["dm:channel:created"]>("dm:channel:created", () => invalidate("dms"));
    bus.on<AppEventMap["dm:channel:deleted"]>("dm:channel:deleted", (d) => {
        invalidate("dms");
        invalidate(`dm:${d.channelId}`);
    });
    bus.on("friend:request:accepted", () => invalidate("friends"));
    bus.on("friend:removed", () => invalidate("friends"));
    bus.onPlain("realtime:reconnected", () => {
        invalidate("guilds");
        invalidate("dms");
        invalidate("friends");
        invalidate("presence:*");
    });
}
