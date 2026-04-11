/**
 * Linux screen capture platform: pipecap (PipeWire portal).
 *
 * Owns the pipecap IPC handlers and the excludePids collection. Mirrors
 * the original inline block in main.ts; the only behavioural change is
 * that this module is now imported lazily by the platform dispatcher.
 */

import type { App, BrowserWindow, IpcMain } from "electron";
import * as fs from "fs";

export function setupLinuxScreenCapture(
    app: App,
    ipcMain: IpcMain,
    getMainWindow: () => BrowserWindow | null,
): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { setupPipecap } = require("@librecord/pipecap/electron/main");

        // Collect every Electron-owned pid for pipecap's `excludePids`.
        // Three sources, unioned:
        //   1. `app.getAppMetrics()` — Electron's own view (incomplete on
        //      some versions, missing utility children like the audio service)
        //   2. /proc/*/exe matching `process.execPath` — the reliable one;
        //      every Chromium process re-execs the same binary
        //   3. Recursive ppid walk from our main pid
        const collectExcludePids = (): number[] => {
            const pids = new Set<number>([process.pid]);
            for (const m of app.getAppMetrics()) pids.add(m.pid);
            const fromMetrics = pids.size;

            let exeMatches = 0;
            try {
                const ourExe = fs.realpathSync(process.execPath);
                const entries = fs.readdirSync("/proc").filter((n: string) => /^\d+$/.test(n));
                const ppid = new Map<number, number>();

                for (const name of entries) {
                    const pid = parseInt(name, 10);
                    try {
                        const exe = fs.readlinkSync(`/proc/${pid}/exe`);
                        const real = fs.realpathSync(exe);
                        if (real === ourExe) {
                            pids.add(pid);
                            exeMatches++;
                        }
                    } catch { /* unreadable — not ours */ }

                    try {
                        const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
                        const lastParen = stat.lastIndexOf(")");
                        if (lastParen < 0) continue;
                        const fields = stat.slice(lastParen + 2).split(" ");
                        ppid.set(pid, parseInt(fields[1], 10));
                    } catch { /* gone */ }
                }

                let added = true;
                while (added) {
                    added = false;
                    for (const [pid, parent] of ppid) {
                        if (pids.has(parent) && !pids.has(pid)) {
                            pids.add(pid);
                            added = true;
                        }
                    }
                }
            } catch (e) {
                console.warn("pipecap: /proc walk for excludePids failed", e);
            }

            console.log(
                `pipecap: collectExcludePids: ${fromMetrics} from getAppMetrics, ${exeMatches} from /proc/*/exe, total=${pids.size}`,
            );
            return [...pids];
        };

        setupPipecap(ipcMain, getMainWindow, {
            transformStartOptions: (options: Record<string, unknown>) => ({
                ...options,
                excludePids: collectExcludePids(),
            }),
        });

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pipecap = require("@librecord/pipecap");
        ipcMain.handle("pipecap:listAudioApps", () => pipecap.listAudioApps());
        ipcMain.handle("pipecap:setAudioTarget", (_e: Electron.IpcMainInvokeEvent, target: string) =>
            pipecap.setAudioTarget(target),
        );
    } catch (e) {
        console.warn("pipecap: native module not available", (e as Error).message);
    }
}
