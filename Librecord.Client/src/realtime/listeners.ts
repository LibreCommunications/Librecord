import { appConnection } from "./connection";
import { mapDmRealtimeToMessage, mapDmRealtimeEdit } from "./dmMappers";
import { mapGuildRealtimeToMessage, mapGuildRealtimeEdit } from "./guildMappers";
import { dispatchAppEvent } from "./eventHelpers";
import { logger } from "../lib/logger";
import {
    addParticipant,
    removeParticipant,
    updateParticipantState,
    getVoiceState,
} from "../voice/voiceStore";
import { playJoinSound, playLeaveSound } from "../voice/sounds";
import type {
    DmRealtimeMessageTransport,
    DmRealtimeMessageEditedTransport,
    DmRealtimeMessageDeletedTransport,
    DmRealtimeReadStateUpdatedTransport,
} from "./dmTypes";
import type {
    GuildRealtimeMessageTransport,
    GuildRealtimeMessageEditedTransport,
    GuildRealtimeMessageDeletedTransport,
} from "./guildTypes";
import type { AppEventMap } from "./events";

export function registerListeners() {

    // Important for StrictMode & reconnects
    appConnection.off("dm:message:ping");
    appConnection.off("dm:message:new");
    appConnection.off("dm:message:edited");
    appConnection.off("dm:message:deleted");
    appConnection.off("dm:user:typing");
    appConnection.off("dm:user:stop-typing");
    appConnection.off("dm:user:presence");
    appConnection.off("dm:readstate:updated");
    appConnection.off("friend:request:received");
    appConnection.off("friend:request:accepted");
    appConnection.off("friend:request:declined");
    appConnection.off("friend:removed");
    appConnection.off("dm:member:left");
    appConnection.off("dm:channel:created");
    appConnection.off("dm:channel:deleted");
    appConnection.off("dm:member:added");
    appConnection.off("dm:leave:ack");

    appConnection.off("guild:message:ping");
    appConnection.off("guild:message:new");
    appConnection.off("guild:message:edited");
    appConnection.off("guild:message:deleted");
    appConnection.off("guild:user:typing");
    appConnection.off("guild:user:stop-typing");
    appConnection.off("guild:user:presence");
    appConnection.off("guild:channel:created");
    appConnection.off("guild:member:roles");
    appConnection.off("guild:member:removed");
    appConnection.off("guild:channel:updated");
    appConnection.off("guild:channel:deleted");
    appConnection.off("guild:updated");
    appConnection.off("guild:deleted");
    appConnection.off("voice:user:joined");
    appConnection.off("voice:user:left");
    appConnection.off("voice:user:state");

    appConnection.off("channel:message:pinned");
    appConnection.off("channel:message:unpinned");
    appConnection.off("channel:reaction:added");
    appConnection.off("channel:reaction:removed");

    appConnection.on(
        "dm:message:ping",
        (payload: { channelId: string; messageId: string; authorId: string; authorName: string }) => {
            dispatchAppEvent("dm:message:ping", payload);
        }
    );

    appConnection.on(
        "dm:message:new",
        (payload: DmRealtimeMessageTransport) => {
            dispatchAppEvent("dm:message:new", {
                message: mapDmRealtimeToMessage(payload),
                clientMessageId: payload.clientMessageId,
            });
        }
    );

    appConnection.on(
        "dm:message:edited",
        (payload: DmRealtimeMessageEditedTransport) => {
            dispatchAppEvent(
                "dm:message:edited",
                mapDmRealtimeEdit(payload)
            );
        }
    );

    appConnection.on(
        "dm:message:deleted",
        (payload: DmRealtimeMessageDeletedTransport) => {
            dispatchAppEvent("dm:message:deleted", payload);
        }
    );

    appConnection.on(
        "dm:user:typing",
        (payload: { channelId: string; userId: string; username: string }) => {
            dispatchAppEvent("dm:user:typing", payload);
        }
    );

    appConnection.on(
        "dm:user:stop-typing",
        (payload: { channelId: string; userId: string }) => {
            dispatchAppEvent("dm:user:stop-typing", payload);
        }
    );

    appConnection.on(
        "dm:user:presence",
        (payload: { userId: string; status: string }) => {
            dispatchAppEvent("dm:user:presence", payload);
        }
    );

    appConnection.on(
        "dm:readstate:updated",
        (payload: DmRealtimeReadStateUpdatedTransport) => {
            dispatchAppEvent("dm:readstate:updated", payload);
        }
    );

    appConnection.on(
        "friend:request:received",
        (payload: { fromUserId: string; fromUsername: string; fromDisplayName: string; fromAvatarUrl: string | null }) => {
            dispatchAppEvent("friend:request:received", payload);
        }
    );

    appConnection.on(
        "friend:request:accepted",
        (payload: { friendUserId: string; friendUsername: string; friendDisplayName: string; friendAvatarUrl: string | null }) => {
            dispatchAppEvent("friend:request:accepted", payload);
        }
    );

    appConnection.on(
        "friend:request:declined",
        (payload: { declinedByUserId: string }) => {
            dispatchAppEvent("friend:request:declined", payload);
        }
    );

    appConnection.on(
        "friend:removed",
        (payload: { removedByUserId: string }) => {
            dispatchAppEvent("friend:removed", payload);
        }
    );

    appConnection.on(
        "dm:channel:created",
        (payload: { channelId: string }) => {
            // Join the new channel's SignalR group so we receive messages
            appConnection.invoke("JoinDmChannel", payload.channelId).catch((err) => {
                logger.realtime.warn("Failed to join new DM channel group", err);
            });
            dispatchAppEvent("dm:channel:created", payload);
        }
    );

    appConnection.on(
        "dm:channel:deleted",
        (payload: { channelId: string }) => {
            dispatchAppEvent("dm:channel:deleted", payload);
        }
    );

    appConnection.on(
        "dm:member:added",
        (payload: { channelId: string; userId: string }) => {
            dispatchAppEvent("dm:member:added", payload);
        }
    );

    appConnection.on(
        "dm:member:left",
        (payload: { channelId: string; userId: string }) => {
            dispatchAppEvent("dm:member:left", payload);
        }
    );

    appConnection.on(
        "dm:leave:ack",
        (payload: { channelId: string }) => {
            appConnection.invoke("LeaveDmChannel", payload.channelId).catch(e => logger.realtime.warn("Failed to leave DM channel group", e));
        }
    );

    appConnection.on(
        "guild:message:ping",
        (payload: { channelId: string; messageId: string; authorId: string; authorName: string }) => {
            dispatchAppEvent("guild:message:ping", payload);
        }
    );

    appConnection.on(
        "guild:message:new",
        (payload: GuildRealtimeMessageTransport) => {
            dispatchAppEvent("guild:message:new", {
                message: mapGuildRealtimeToMessage(payload),
                clientMessageId: payload.clientMessageId,
            });
        }
    );

    appConnection.on(
        "guild:message:edited",
        (payload: GuildRealtimeMessageEditedTransport) => {
            dispatchAppEvent(
                "guild:message:edited",
                mapGuildRealtimeEdit(payload)
            );
        }
    );

    appConnection.on(
        "guild:message:deleted",
        (payload: GuildRealtimeMessageDeletedTransport) => {
            dispatchAppEvent("guild:message:deleted", payload);
        }
    );

    appConnection.on(
        "guild:user:typing",
        (payload: { channelId: string; userId: string; username: string }) => {
            dispatchAppEvent("guild:user:typing", payload);
        }
    );

    appConnection.on(
        "guild:user:stop-typing",
        (payload: { channelId: string; userId: string }) => {
            dispatchAppEvent("guild:user:stop-typing", payload);
        }
    );

    appConnection.on(
        "guild:user:presence",
        (payload: { userId: string; status: string }) => {
            dispatchAppEvent("guild:user:presence", payload);
        }
    );

    appConnection.on(
        "guild:channel:created",
        (payload: { channelId: string; guildId: string; name: string; type: number; position: number }) => {
            // Join the new channel group so we receive real-time events for it
            appConnection.invoke("JoinGuildChannel", payload.channelId).catch((err) => {
                logger.realtime.warn("Failed to join new channel group", err);
            });
            dispatchAppEvent("guild:channel:created", payload);
        }
    );

    appConnection.on(
        "guild:member:roles",
        (payload: { guildId: string; userId: string; roles: { id: string; name: string }[] }) => {
            dispatchAppEvent("guild:member:roles", payload);
        }
    );

    appConnection.on(
        "guild:member:removed",
        (payload: { guildId: string; userId: string; action: "kick" | "ban" | "leave"; reason?: string | null }) => {
            dispatchAppEvent("guild:member:removed", payload);
        }
    );

    appConnection.on(
        "guild:channel:updated",
        (payload: { channelId: string; guildId: string; name: string; topic?: string | null }) => {
            dispatchAppEvent("guild:channel:updated", payload);
        }
    );

    appConnection.on(
        "guild:channel:deleted",
        (payload: { channelId: string; guildId: string }) => {
            dispatchAppEvent("guild:channel:deleted", payload);
        }
    );

    appConnection.on(
        "guild:updated",
        (payload: { guildId: string; name?: string; iconUrl?: string | null }) => {
            dispatchAppEvent("guild:updated", payload);
        }
    );

    appConnection.on(
        "guild:deleted",
        (payload: { guildId: string }) => {
            dispatchAppEvent("guild:deleted", payload);
        }
    );

    appConnection.on(
        "voice:user:joined",
        (payload: AppEventMap["voice:user:joined"]) => {
            const vsJoin = getVoiceState();
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
            dispatchAppEvent("voice:user:joined", payload);
            if (vsJoin.isConnected && vsJoin.channelId === payload.channelId) {
                playJoinSound();
            }
        }
    );

    appConnection.on(
        "voice:user:left",
        (payload: AppEventMap["voice:user:left"]) => {
            const vsLeave = getVoiceState();
            removeParticipant(payload.userId);
            dispatchAppEvent("voice:user:left", payload);
            if (vsLeave.isConnected && vsLeave.channelId === payload.channelId) {
                playLeaveSound();
            }
        }
    );

    appConnection.on(
        "voice:user:state",
        (payload: AppEventMap["voice:user:state"]) => {
            updateParticipantState(payload.userId, {
                isMuted: payload.isMuted,
                isDeafened: payload.isDeafened,
                isCameraOn: payload.isCameraOn,
                isScreenSharing: payload.isScreenSharing,
            });
            dispatchAppEvent("voice:user:state", payload);
        }
    );

    appConnection.on(
        "channel:message:pinned",
        (payload: { channelId: string; messageId: string }) => {
            dispatchAppEvent("channel:message:pinned", payload);
        }
    );

    appConnection.on(
        "channel:message:unpinned",
        (payload: { channelId: string; messageId: string }) => {
            dispatchAppEvent("channel:message:unpinned", payload);
        }
    );

    appConnection.on(
        "channel:reaction:added",
        (payload: AppEventMap["channel:reaction:added"]) => {
            dispatchAppEvent("channel:reaction:added", payload);
        }
    );

    appConnection.on(
        "channel:reaction:removed",
        (payload: AppEventMap["channel:reaction:removed"]) => {
            dispatchAppEvent("channel:reaction:removed", payload);
        }
    );
}
