import { useEffect, useState } from "react";
import { getVoiceState } from "../../voice/voiceStore";

const BUILD_ID = import.meta.env.VITE_BUILD_ID as string | undefined;
const POLL_INTERVAL = 60_000;

export function UpdateBanner() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!BUILD_ID) return;

        async function check() {
            try {
                const res = await fetch("/version.json", { cache: "no-store" });
                if (!res.ok) return;
                const { buildId } = await res.json();
                if (buildId && buildId !== BUILD_ID) {
                    setUpdateAvailable(true);
                }
            } catch { /* offline or dev server */ }
        }

        const id = setInterval(check, POLL_INTERVAL);
        return () => clearInterval(id);
    }, []);

    if (!updateAvailable || dismissed) return null;

    // Don't show during active voice calls
    if (getVoiceState().isConnected) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-[#5865F2] text-white text-sm rounded-lg px-4 py-2.5 shadow-lg">
            <span>A new version is available.</span>
            <button
                onClick={() => window.location.reload()}
                className="font-medium underline underline-offset-2 hover:text-white/80"
            >
                Refresh
            </button>
            <button
                onClick={() => setDismissed(true)}
                className="text-white/60 hover:text-white ml-1"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    );
}
