import { useConnectionState } from "../../hooks/useConnectionState";

export function ConnectionBanner() {
    const state = useConnectionState();

    if (state === "connected" || state === "connecting") return null;

    const isReconnecting = state === "reconnecting";

    return (
        <div
            className={`fixed top-0 left-0 right-0 z-50 text-center text-xs py-1 font-medium ${
                isReconnecting
                    ? "bg-yellow-600 text-white"
                    : "bg-[#da373c] text-white"
            }`}
        >
            {isReconnecting
                ? "Reconnecting..."
                : "Connection lost. Trying to reconnect..."}
        </div>
    );
}
