import { guildConnection } from "./guildConnection";
import { mapGuildRealtimeToMessage, mapGuildRealtimeEdit } from "./guildMappers";
import { dispatchGuildEvent } from "./guildEventHelpers";
import {
    addParticipant,
    removeParticipant,
    updateParticipantState,
} from "../../voice/voiceStore";
import type {
    GuildRealtimeMessageTransport,
    GuildRealtimeMessageEditedTransport,
    GuildRealtimeMessageDeletedTransport,
} from "./guildTypes";
import type { GuildEventMap } from "./guildEvents";

export function registerGuildListeners() {
    console.log("[Guild] registering guild listeners");

    guildConnection.off("guild:message:ping");
    guildConnection.off("guild:message:new");
    guildConnection.off("guild:message:edited");
    guildConnection.off("guild:message:deleted");
    guildConnection.off("guild:user:typing");
    guildConnection.off("guild:user:stop-typing");
    guildConnection.off("guild:user:presence");
    guildConnection.off("guild:channel:created");
    guildConnection.off("guild:deleted");
    guildConnection.off("voice:user:joined");
    guildConnection.off("voice:user:left");
    guildConnection.off("voice:user:state");
    guildConnection.off("channel:message:pinned");
    guildConnection.off("channel:message:unpinned");

    /* ------------------------------------------------------------------ */
    /* MESSAGE PING (lightweight — for unread badges + notifications)      */
    /* ------------------------------------------------------------------ */
    guildConnection.on(
        "guild:message:ping",
        (payload: { channelId: string; messageId: string; authorId: string; authorName: string }) => {
            dispatchGuildEvent("guild:message:ping", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* MESSAGE CREATED (full payload — consumed by active channel view)    */
    /* ------------------------------------------------------------------ */
    guildConnection.on(
        "guild:message:new",
        (payload: GuildRealtimeMessageTransport) => {
            console.log("[SignalR] guild:message:new", payload);

            dispatchGuildEvent("guild:message:new", {
                message: mapGuildRealtimeToMessage(payload),
                clientMessageId: payload.clientMessageId,
            });
        }
    );

    guildConnection.on(
        "guild:message:edited",
        (payload: GuildRealtimeMessageEditedTransport) => {
            console.log("[SignalR] guild:message:edited", payload);

            dispatchGuildEvent(
                "guild:message:edited",
                mapGuildRealtimeEdit(payload)
            );
        }
    );

    guildConnection.on(
        "guild:message:deleted",
        (payload: GuildRealtimeMessageDeletedTransport) => {
            console.log("[SignalR] guild:message:deleted", payload);

            dispatchGuildEvent("guild:message:deleted", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* TYPING                                                              */
    /* ------------------------------------------------------------------ */
    guildConnection.on(
        "guild:user:typing",
        (payload: { channelId: string; userId: string; username: string }) => {
            dispatchGuildEvent("guild:user:typing", payload);
        }
    );

    guildConnection.on(
        "guild:user:stop-typing",
        (payload: { channelId: string; userId: string }) => {
            dispatchGuildEvent("guild:user:stop-typing", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* PRESENCE                                                            */
    /* ------------------------------------------------------------------ */
    guildConnection.on(
        "guild:user:presence",
        (payload: { userId: string; status: string }) => {
            dispatchGuildEvent("guild:user:presence", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* CHANNEL CREATED — auto-join the new channel's SignalR group          */
    /* ------------------------------------------------------------------ */
    guildConnection.on(
        "guild:channel:created",
        (payload: { channelId: string; guildId: string; name: string; type: number; position: number }) => {
            console.log("[SignalR] guild:channel:created", payload);
            // Join the new channel group so we receive real-time events for it
            guildConnection.invoke("JoinChannel", payload.channelId).catch((err) => {
                console.warn("[SignalR] Failed to join new channel group", err);
            });
            dispatchGuildEvent("guild:channel:created", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* GUILD DELETED                                                        */
    /* ------------------------------------------------------------------ */
    guildConnection.on(
        "guild:deleted",
        (payload: { guildId: string }) => {
            console.log("[SignalR] guild:deleted", payload);
            dispatchGuildEvent("guild:deleted", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* PIN / UNPIN (guild channels)                                         */
    /* ------------------------------------------------------------------ */
    guildConnection.on(
        "channel:message:pinned",
        (payload: { channelId: string; messageId: string }) => {
            console.log("[SignalR] channel:message:pinned", payload);
            dispatchGuildEvent("channel:message:pinned", payload);
        }
    );

    guildConnection.on(
        "channel:message:unpinned",
        (payload: { channelId: string; messageId: string }) => {
            console.log("[SignalR] channel:message:unpinned", payload);
            dispatchGuildEvent("channel:message:unpinned", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* VOICE                                                               */
    /* ------------------------------------------------------------------ */
    guildConnection.on(
        "voice:user:joined",
        (payload: GuildEventMap["voice:user:joined"]) => {
            console.log("[SignalR] voice:user:joined", payload);
            addParticipant({
                userId: payload.userId,
                username: payload.username,
                displayName: payload.displayName,
                avatarUrl: payload.avatarUrl,
                isMuted: payload.isMuted,
                isDeafened: payload.isDeafened,
                isCameraOn: payload.isCameraOn,
                isScreenSharing: payload.isScreenSharing,
                joinedAt: new Date().toISOString(),
            });
            dispatchGuildEvent("voice:user:joined", payload);
        }
    );

    guildConnection.on(
        "voice:user:left",
        (payload: GuildEventMap["voice:user:left"]) => {
            console.log("[SignalR] voice:user:left", payload);
            removeParticipant(payload.userId);
            dispatchGuildEvent("voice:user:left", payload);
        }
    );

    guildConnection.on(
        "voice:user:state",
        (payload: GuildEventMap["voice:user:state"]) => {
            console.log("[SignalR] voice:user:state", payload);
            updateParticipantState(payload.userId, {
                isMuted: payload.isMuted,
                isDeafened: payload.isDeafened,
                isCameraOn: payload.isCameraOn,
                isScreenSharing: payload.isScreenSharing,
            });
            dispatchGuildEvent("voice:user:state", payload);
        }
    );
}
