import { useEffect, useState } from "react";
import { getElectronAPI } from "@librecord/domain";

/**
 * Listens for `update-downloaded` from the Electron updater and prompts
 * the user to restart. If they click "Restart now" the main process calls
 * `quitAndInstall` and the app re-launches into the new version. If they
 * dismiss, `autoInstallOnAppQuit = true` will install on the next manual
 * quit anyway.
 *
 * Two data paths (both required):
 *   1. Live event: `onUpdateDownloaded` for updates that finish after
 *      the renderer has mounted and registered its listener.
 *   2. Poll on mount: `getPendingUpdate()` for updates that finished
 *      BEFORE this component mounted (download is often fast enough
 *      to complete while React is still parsing lazy chunks).
 *
 * Mounted once at the top of the desktop App tree. Web/mobile builds get
 * `getElectronAPI()` returning undefined and the effects short-circuit.
 */
export function UpdateModal() {
    const [pendingVersion, setPendingVersion] = useState<string | null>(null);
    const [installing, setInstalling] = useState(false);

    // Path 1: listen for updates downloaded AFTER this component mounts.
    useEffect(() => {
        const api = getElectronAPI();
        if (!api?.onUpdateDownloaded) return;
        return api.onUpdateDownloaded((version) => {
            setPendingVersion(version);
        });
    }, []);

    // Path 2: catch updates downloaded BEFORE this component mounted.
    // Without this, a fast download that completes during app startup
    // would fire `update-downloaded` into the void — nobody listening,
    // message lost forever, user never sees the modal.
    useEffect(() => {
        const api = getElectronAPI();
        if (!api?.getPendingUpdate) return;
        let cancelled = false;
        api.getPendingUpdate().then((version) => {
            if (!cancelled && version) setPendingVersion(version);
        }).catch(() => { /* dev builds or IPC error — ignore */ });
        return () => { cancelled = true; };
    }, []);

    const [dismissed, setDismissed] = useState(false);

    if (!pendingVersion || dismissed) return null;

    async function handleRestart() {
        const api = getElectronAPI();
        if (!api?.installUpdateNow) return;
        setInstalling(true);
        try {
            await api.installUpdateNow();
            // The main process will quit-and-relaunch; this line will
            // typically never run.
        } catch {
            setInstalling(false);
        }
    }

    // Non-blocking bottom-right card. autoInstallOnAppQuit = true means
    // that even if the user dismisses or ignores this, the update will
    // install next time they manually quit the app.
    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed bottom-4 right-4 z-[10000] w-[280px] bg-[#1e1f22] border border-[#2b2d31] rounded-xl shadow-2xl p-5 animate-[scaleIn_0.2s_ease-out]"
        >
            <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss update notification"
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-[#949ba4] hover:text-white hover:bg-white/10 rounded transition-colors"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>

            <div className="flex flex-col items-center text-center">
                <img src="/librecord.svg" alt="" className="w-10 h-10 mb-3 opacity-90" />
                <h2 className="text-[15px] font-semibold text-white">
                    Updated to {pendingVersion}
                </h2>
                <p className="text-xs text-[#949ba4] mt-1 mb-4">Relaunch to apply</p>
                <button
                    type="button"
                    onClick={handleRestart}
                    disabled={installing}
                    className="w-full py-2 text-sm font-medium text-white bg-[#5865F2] hover:bg-[#4752c4] rounded-md disabled:opacity-50 transition-colors"
                >
                    {installing ? "Relaunching…" : "Relaunch"}
                </button>
            </div>
        </div>
    );
}
