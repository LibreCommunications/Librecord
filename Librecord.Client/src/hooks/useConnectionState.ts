import { useSyncExternalStore } from "react";
import { getConnectionState, subscribeConnectionState } from "../realtime/connection";

export function useConnectionState() {
    return useSyncExternalStore(subscribeConnectionState, getConnectionState);
}
