import { dmConnection } from "./dmConnection";
import { mapDmRealtimeEdit, mapDmRealtimeToMessage } from "./dmMappers";
import { dispatchDmEvent } from "./dmEventHelpers";
import type {
    DmRealtimeMessageTransport,
    DmRealtimeMessageEditedTransport,
    DmRealtimeMessageDeletedTransport,
    DmRealtimeReadStateUpdatedTransport,
} from "./dmTypes";

export function registerDmListeners() {
    console.log("[DM] registering DM listeners");

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
            console.log("[SignalR] dm:message:new", payload);

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
            console.log("[SignalR] dm:message:edited", payload);

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
            console.log("[SignalR] dm:message:deleted", payload);

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
            console.log("[SignalR] dm:readstate:updated", payload);
            dispatchDmEvent("dm:readstate:updated", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* FRIENDSHIP EVENTS                                                    */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "friend:request:received",
        (payload: { fromUserId: string; fromUsername: string; fromDisplayName: string; fromAvatarUrl: string | null }) => {
            console.log("[SignalR] friend:request:received", payload);
            dispatchDmEvent("friend:request:received", payload);
        }
    );

    dmConnection.on(
        "friend:request:accepted",
        (payload: { friendUserId: string; friendUsername: string; friendDisplayName: string; friendAvatarUrl: string | null }) => {
            console.log("[SignalR] friend:request:accepted", payload);
            dispatchDmEvent("friend:request:accepted", payload);
        }
    );

    dmConnection.on(
        "friend:request:declined",
        (payload: { declinedByUserId: string }) => {
            console.log("[SignalR] friend:request:declined", payload);
            dispatchDmEvent("friend:request:declined", payload);
        }
    );

    dmConnection.on(
        "friend:removed",
        (payload: { removedByUserId: string }) => {
            console.log("[SignalR] friend:removed", payload);
            dispatchDmEvent("friend:removed", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* PIN / UNPIN (DM channels)                                            */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "channel:message:pinned",
        (payload: { channelId: string; messageId: string }) => {
            console.log("[SignalR] channel:message:pinned", payload);
            dispatchDmEvent("channel:message:pinned", payload);
        }
    );

    dmConnection.on(
        "channel:message:unpinned",
        (payload: { channelId: string; messageId: string }) => {
            console.log("[SignalR] channel:message:unpinned", payload);
            dispatchDmEvent("channel:message:unpinned", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM CHANNEL CREATED (new DM started by another user)                  */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:channel:created",
        (payload: { channelId: string }) => {
            console.log("[SignalR] dm:channel:created", payload);
            // Join the new channel's SignalR group so we receive messages
            dmConnection.invoke("JoinChannel", payload.channelId).catch((err) => {
                console.warn("[SignalR] Failed to join new DM channel group", err);
            });
            dispatchDmEvent("dm:channel:created", payload);
        }
    );

    /* ------------------------------------------------------------------ */
    /* DM MEMBER LEFT (group DM membership change)                          */
    /* ------------------------------------------------------------------ */
    dmConnection.on(
        "dm:member:left",
        (payload: { channelId: string; userId: string }) => {
            console.log("[SignalR] dm:member:left", payload);
            dispatchDmEvent("dm:member:left", payload);
        }
    );
}
