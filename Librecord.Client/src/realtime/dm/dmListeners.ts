import { dmConnection } from "./dmConnection";
import { mapDmRealtimeEdit, mapDmRealtimeToMessage } from "./dmMappers";
import { dispatchDmEvent } from "./dmEventHelpers";
import type {
    DmRealtimeMessageTransport,
    DmRealtimeMessageEditedTransport,
    DmRealtimeMessageDeletedTransport,
    DmRealtimeReadStateUpdatedTransport,
} from "./dmTypes";
import type { DmEventMap } from "./dmEvents";

export function registerDmListeners() {

    /* ------------------------------------------------------------------ */
    /* CLEAN UP (important for StrictMode & reconnects)                    */
    /* ------------------------------------------------------------------ */
    dmConnection.off("dm:message:ping");
    dmConnection.off("dm:message:new");
    dmConnection.off("dm:message:edited");
    dmConnection.off("dm:message:deleted");
    dmConnection.off("dm:user:typing");
    dmConnection.off("dm:user:stop-typing");
    dmConnection.off("dm:user:presence");
    dmConnection.off("dm:readstate:updated");
    dmConnection.off("friend:request:received");
    dmConnection.off("friend:request:accepted");
    dmConnection.off("friend:request:declined");
    dmConnection.off("friend:removed");
    dmConnection.off("channel:message:pinned");
    dmConnection.off("channel:message:unpinned");
    dmConnection.off("dm:member:left");
    dmConnection.off("dm:channel:created");
    dmConnection.off("dm:channel:deleted");
    dmConnection.off("dm:member:added");
    dmConnection.off("dm:leave:ack");
    dmConnection.off("channel:reaction:added");
    dmConnection.off("channel:reaction:removed");

    /* ------------------------------------------------------------------ */
    /* MESSAGE PING (lightweight — for unread badges + notifications)      */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:message:ping",
        (payload: { channelId: string; messageId: string; authorId: string; authorName: string }) => {
            dispatchDmEvent("dm:message:ping", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* MESSAGE CREATED (full payload — consumed by active channel view)    */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:message:new",
        (payload: DmRealtimeMessageTransport) => {

            dispatchDmEvent("dm:message:new", {
                message: mapDmRealtimeToMessage(payload),
                clientMessageId: payload.clientMessageId,
            });
        }
    );

    /* ------------------------------------------------------------------ */
    /* MESSAGE EDITED                                                      */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:message:edited",
        (payload: DmRealtimeMessageEditedTransport) => {

            dispatchDmEvent(
                "dm:message:edited",
                mapDmRealtimeEdit(payload)
            );
        }
    );

    /* ------------------------------------------------------------------ */
    /* MESSAGE DELETED                                                     */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:message:deleted",
        (payload: DmRealtimeMessageDeletedTransport) => {

            dispatchDmEvent("dm:message:deleted", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* TYPING                                                              */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:user:typing",
        (payload: { channelId: string; userId: string; username: string }) => {
            dispatchDmEvent("dm:user:typing", payload);
        }
    );

    dmConnection.on(
        "dm:user:stop-typing",
        (payload: { channelId: string; userId: string }) => {
            dispatchDmEvent("dm:user:stop-typing", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* PRESENCE                                                            */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:user:presence",
        (payload: { userId: string; status: string }) => {
            dispatchDmEvent("dm:user:presence", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* READ STATE UPDATED                                                   */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:readstate:updated",
        (payload: DmRealtimeReadStateUpdatedTransport) => {
            dispatchDmEvent("dm:readstate:updated", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* FRIENDSHIP EVENTS                                                    */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "friend:request:received",
        (payload: { fromUserId: string; fromUsername: string; fromDisplayName: string; fromAvatarUrl: string | null }) => {
            dispatchDmEvent("friend:request:received", payload);
        }
    );

    dmConnection.on(
        "friend:request:accepted",
        (payload: { friendUserId: string; friendUsername: string; friendDisplayName: string; friendAvatarUrl: string | null }) => {
            dispatchDmEvent("friend:request:accepted", payload);
        }
    );

    dmConnection.on(
        "friend:request:declined",
        (payload: { declinedByUserId: string }) => {
            dispatchDmEvent("friend:request:declined", payload);
        }
    );

    dmConnection.on(
        "friend:removed",
        (payload: { removedByUserId: string }) => {
            dispatchDmEvent("friend:removed", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* PIN / UNPIN (DM channels)                                            */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "channel:message:pinned",
        (payload: { channelId: string; messageId: string }) => {
            dispatchDmEvent("channel:message:pinned", payload);
        }
    );

    dmConnection.on(
        "channel:message:unpinned",
        (payload: { channelId: string; messageId: string }) => {
            dispatchDmEvent("channel:message:unpinned", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* REACTIONS                                                            */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "channel:reaction:added",
        (payload: DmEventMap["channel:reaction:added"]) => {
            dispatchDmEvent("channel:reaction:added", payload);
        }
    );

    dmConnection.on(
        "channel:reaction:removed",
        (payload: DmEventMap["channel:reaction:removed"]) => {
            dispatchDmEvent("channel:reaction:removed", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM CHANNEL CREATED (new DM started by another user)                  */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:channel:created",
        (payload: { channelId: string }) => {
            // Join the new channel's SignalR group so we receive messages
            dmConnection.invoke("JoinChannel", payload.channelId).catch((err) => {
                console.warn("[SignalR] Failed to join new DM channel group", err);
            });
            dispatchDmEvent("dm:channel:created", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM CHANNEL DELETED (1-on-1 DM deleted by a member)                    */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:channel:deleted",
        (payload: { channelId: string }) => {
            dispatchDmEvent("dm:channel:deleted", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM MEMBER ADDED (new participant in group DM)                         */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:member:added",
        (payload: { channelId: string; userId: string }) => {
            dispatchDmEvent("dm:member:added", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM MEMBER LEFT (group DM membership change)                          */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:member:left",
        (payload: { channelId: string; userId: string }) => {
            dispatchDmEvent("dm:member:left", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM LEAVE ACK — server tells THIS user to leave a SignalR group (#55) */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:leave:ack",
        (payload: { channelId: string }) => {
            dmConnection.invoke("LeaveChannel", payload.channelId).catch(() => {});
        }
    );
}
