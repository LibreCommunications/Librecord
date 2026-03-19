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
    dmConnection.off("dm:message:new");
    dmConnection.off("dm:message:edited");
    dmConnection.off("dm:message:deleted");
    dmConnection.off("dm:user:typing");
    dmConnection.off("dm:user:stop-typing");
    dmConnection.off("dm:user:presence");
    dmConnection.off("dm:readstate:updated");

    /* ------------------------------------------------------------------ */
    /* MESSAGE CREATED                                                     */
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
}
