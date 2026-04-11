import { useEffect, useState } from "react";
import { getElectronAPI } from "@librecord/domain";

/**
 * Listens for `update-downloaded` from the Electron updater and prompts
 * the user to restart. If they click "Restart now" the main process calls
 * `quitAndInstall` and the app re-launches into the new version. If they
 * dismiss, `autoInstallOnAppQuit = true` will install on the next manual
 * quit anyway.
 *
 * Mounted once at the top of the desktop App tree. Web/mobile builds get
 * `getElectronAPI()` returning undefined and the effect short-circuits.
 */
export function UpdateModal() {
    const [pendingVersion, setPendingVersion] = useState<string | null>(null);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        const api = getElectronAPI();
        if (!api?.onUpdateDownloaded) return;
        return api.onUpdateDownloaded((version) => {
            setPendingVersion(version);
        });
    }, []);

    if (!pendingVersion) return null;

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

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60">
            <div className="bg-[#111214] border border-[#2b2d31] rounded-xl shadow-2xl w-[420px] p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Update ready</h2>
                <p className="text-sm text-[#b5bac1] mb-5">
                    Librecord <span className="text-white font-mono">v{pendingVersion}</span>{" "}
                    has been downloaded. Restart now to install — it takes a few seconds.
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setPendingVersion(null)}
                        disabled={installing}
                        className="px-4 py-2 text-sm text-[#dbdee1] hover:bg-white/10 rounded disabled:opacity-50"
                    >
                        Later
                    </button>
                    <button
                        type="button"
                        onClick={handleRestart}
                        disabled={installing}
                        className="px-4 py-2 text-sm font-medium text-white bg-[#5865f2] hover:bg-[#4752c4] rounded disabled:opacity-50"
                    >
                        {installing ? "Restarting…" : "Restart now"}
                    </button>
                </div>
            </div>
        </div>
    );
}
