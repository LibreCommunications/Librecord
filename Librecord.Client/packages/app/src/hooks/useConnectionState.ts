import { useSyncExternalStore } from "react";
import { getConnectionState, subscribeConnectionState } from "@librecord/api-client";

export function useConnectionState() {
    return useSyncExternalStore(subscribeConnectionState, getConnectionState);
}
