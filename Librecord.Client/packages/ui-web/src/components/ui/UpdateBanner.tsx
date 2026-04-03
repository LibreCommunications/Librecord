import { useEffect, useState } from "react";
import { CloseIcon } from "./Icons";
import { STORAGE } from "@librecord/domain";

declare const __BUILD_ID__: string | undefined;

const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : undefined;
const POLL_INTERVAL = 30_000;

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

        check();
        const id = setInterval(check, POLL_INTERVAL);
        return () => clearInterval(id);
    }, []);

    if (!updateAvailable || dismissed) return null;

    function handleRefresh() {
        // Save current page so it can be restored after reload
        sessionStorage.setItem(STORAGE.returnUrl, window.location.pathname);
        window.location.reload();
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-[#5865F2] text-white text-sm rounded-lg px-4 py-2.5 shadow-lg animate-in fade-in">
            <span>A new version is available.</span>
            <button
                onClick={handleRefresh}
                className="font-medium underline underline-offset-2 hover:text-white/80"
            >
                Refresh
            </button>
            <button
                onClick={() => setDismissed(true)}
                className="text-white/60 hover:text-white ml-1"
            >
                <CloseIcon size={14} />
            </button>
        </div>
    );
}
