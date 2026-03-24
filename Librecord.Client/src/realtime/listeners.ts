import { appConnection } from "./connection";
import { mapDmRealtimeToMessage, mapDmRealtimeEdit } from "./dmMappers";
import { mapGuildRealtimeToMessage, mapGuildRealtimeEdit } from "./guildMappers";
import { dispatchAppEvent } from "./eventHelpers";
import {
    addParticipant,
    removeParticipant,
    updateParticipantState,
} from "../voice/voiceStore";
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

    /* ------------------------------------------------------------------ */
    /* CLEAN UP (important for StrictMode & reconnects)                    */
    /* ------------------------------------------------------------------ */

    // DM events
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

    // Guild events
    appConnection.off("guild:message:ping");
    appConnection.off("guild:message:new");
    appConnection.off("guild:message:edited");
    appConnection.off("guild:message:deleted");
    appConnection.off("guild:user:typing");
    appConnection.off("guild:user:stop-typing");
    appConnection.off("guild:user:presence");
    appConnection.off("guild:channel:created");
    appConnection.off("guild:deleted");
    appConnection.off("voice:user:joined");
    appConnection.off("voice:user:left");
    appConnection.off("voice:user:state");

    // Shared events
    appConnection.off("channel:message:pinned");
    appConnection.off("channel:message:unpinned");
    appConnection.off("channel:reaction:added");
    appConnection.off("channel:reaction:removed");

    /* ================================================================== */
    /* DM LISTENERS                                                        */
    /* ================================================================== */

    /* ------------------------------------------------------------------ */
    /* MESSAGE PING (lightweight — for unread badges + notifications)      */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:message:ping",
        (payload: { channelId: string; messageId: string; authorId: string; authorName: string }) => {
            dispatchAppEvent("dm:message:ping", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* MESSAGE CREATED (full payload — consumed by active channel view)    */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:message:new",
        (payload: DmRealtimeMessageTransport) => {
            dispatchAppEvent("dm:message:new", {
                message: mapDmRealtimeToMessage(payload),
                clientMessageId: payload.clientMessageId,
            });
        }
    );

    /* ------------------------------------------------------------------ */
    /* MESSAGE EDITED                                                      */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:message:edited",
        (payload: DmRealtimeMessageEditedTransport) => {
            dispatchAppEvent(
                "dm:message:edited",
                mapDmRealtimeEdit(payload)
            );
        }
    );

    /* ------------------------------------------------------------------ */
    /* MESSAGE DELETED                                                     */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:message:deleted",
        (payload: DmRealtimeMessageDeletedTransport) => {
            dispatchAppEvent("dm:message:deleted", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* TYPING                                                              */
    /* ------------------------------------------------------------------ */
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

    /* ------------------------------------------------------------------ */
    /* PRESENCE                                                            */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:user:presence",
        (payload: { userId: string; status: string }) => {
            dispatchAppEvent("dm:user:presence", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* READ STATE UPDATED                                                   */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:readstate:updated",
        (payload: DmRealtimeReadStateUpdatedTransport) => {
            dispatchAppEvent("dm:readstate:updated", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* FRIENDSHIP EVENTS                                                    */
    /* ------------------------------------------------------------------ */
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

    /* ------------------------------------------------------------------ */
    /* DM CHANNEL CREATED (new DM started by another user)                  */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:channel:created",
        (payload: { channelId: string }) => {
            // Join the new channel's SignalR group so we receive messages
            appConnection.invoke("JoinDmChannel", payload.channelId).catch((err) => {
                console.warn("[SignalR] Failed to join new DM channel group", err);
            });
            dispatchAppEvent("dm:channel:created", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM CHANNEL DELETED (1-on-1 DM deleted by a member)                    */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:channel:deleted",
        (payload: { channelId: string }) => {
            dispatchAppEvent("dm:channel:deleted", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM MEMBER ADDED (new participant in group DM)                         */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:member:added",
        (payload: { channelId: string; userId: string }) => {
            dispatchAppEvent("dm:member:added", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM MEMBER LEFT (group DM membership change)                          */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:member:left",
        (payload: { channelId: string; userId: string }) => {
            dispatchAppEvent("dm:member:left", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM LEAVE ACK — server tells THIS user to leave a SignalR group (#55) */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "dm:leave:ack",
        (payload: { channelId: string }) => {
            appConnection.invoke("LeaveDmChannel", payload.channelId).catch(() => {});
        }
    );

    /* ================================================================== */
    /* GUILD LISTENERS                                                      */
    /* ================================================================== */

    /* ------------------------------------------------------------------ */
    /* MESSAGE PING (lightweight — for unread badges + notifications)      */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "guild:message:ping",
        (payload: { channelId: string; messageId: string; authorId: string; authorName: string }) => {
            dispatchAppEvent("guild:message:ping", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* MESSAGE CREATED (full payload — consumed by active channel view)    */
    /* ------------------------------------------------------------------ */
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

    /* ------------------------------------------------------------------ */
    /* TYPING                                                              */
    /* ------------------------------------------------------------------ */
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

    /* ------------------------------------------------------------------ */
    /* PRESENCE                                                            */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "guild:user:presence",
        (payload: { userId: string; status: string }) => {
            dispatchAppEvent("guild:user:presence", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* CHANNEL CREATED — auto-join the new channel's SignalR group          */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "guild:channel:created",
        (payload: { channelId: string; guildId: string; name: string; type: number; position: number }) => {
            // Join the new channel group so we receive real-time events for it
            appConnection.invoke("JoinGuildChannel", payload.channelId).catch((err) => {
                console.warn("[SignalR] Failed to join new channel group", err);
            });
            dispatchAppEvent("guild:channel:created", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* GUILD DELETED                                                        */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "guild:deleted",
        (payload: { guildId: string }) => {
            dispatchAppEvent("guild:deleted", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* VOICE                                                               */
    /* ------------------------------------------------------------------ */
    appConnection.on(
        "voice:user:joined",
        (payload: AppEventMap["voice:user:joined"]) => {
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
        }
    );

    appConnection.on(
        "voice:user:left",
        (payload: AppEventMap["voice:user:left"]) => {
            removeParticipant(payload.userId);
            dispatchAppEvent("voice:user:left", payload);
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

    /* ================================================================== */
    /* SHARED LISTENERS (channel:* events — used by both DM and Guild)     */
    /* ================================================================== */

    /* ------------------------------------------------------------------ */
    /* PIN / UNPIN                                                          */
    /* ------------------------------------------------------------------ */
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

    /* ------------------------------------------------------------------ */
    /* REACTIONS                                                            */
    /* ------------------------------------------------------------------ */
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
