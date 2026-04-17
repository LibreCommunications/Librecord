/**
 * Windows audio-capture platform bridge: @librecord/winaudio (WASAPI
 * loopback via Rust/napi-rs).
 *
 * Surface exposed via IPC:
 *   winaudio:available         → boolean (safe to call on any platform)
 *   winaudio:getCapabilities   → { processLoopback, windowsBuild }
 *   winaudio:startAudio        → constructs AudioSession (system or
 *                                per-process loopback)
 *   winaudio:stopAudio
 *
 * And forwarded to the renderer:
 *   winaudio:audio             → loopback samples (float32)
 *   winaudio:audio-error       → native error
 *
 * Video capture on Windows is handled by Chromium's getDisplayMedia
 * directly (single hardware encode, no IPC readback) — see main.ts's
 * setDisplayMediaRequestHandler. This module does not touch video.
 */

import type { App, BrowserWindow, IpcMain } from "electron";
import * as os from "os";

/** Parse Windows build number from os.release() (e.g. "10.0.22631" → 22631).
 *  Windows 11 is build 22000+; per-process WASAPI loopback
 *  (PROCESS_LOOPBACK + EXCLUDE_TARGET_PROCESS_TREE) is only available
 *  from that build onwards. */
function getWindowsBuild(): number {
    const r = os.release(); // e.g. "10.0.22631"
    const build = parseInt(r.split(".")[2] ?? "0", 10);
    return Number.isFinite(build) ? build : 0;
}

interface AudioSessionLike {
    start(): void;
    stop(): void;
    on(event: "chunk", cb: (chunk: {
        timestampNs: bigint;
        frameCount: number;
        sampleRate: number;
        channels: number;
        data: ArrayBuffer;
    }) => void): void;
    on(event: "error", cb: (err: unknown) => void): void;
    removeAllListeners?(): void;
}

export function setupWindowsScreenCapture(
    app: App,
    ipcMain: IpcMain,
    getMainWindow: () => BrowserWindow | null,
): void {
    let winaudio: {
        AudioSession: new (opts: unknown) => AudioSessionLike;
    };

    // Probe the native module in a forked child process first. A native
    // crash (segfault) in the .node binary would kill the main Electron
    // process because try/catch can't intercept it. Requiring it in a
    // disposable child detects the crash safely.
    let probePassed = false;
    try {
        const modulePath = require.resolve("@librecord/winaudio");
        const { spawnSync } = require("child_process") as typeof import("child_process");
        const result = spawnSync(process.execPath, [
            "-e", `try { require(${JSON.stringify(modulePath)}); process.exit(0); } catch { process.exit(1); }`,
        ], { timeout: 5000, stdio: "ignore", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
        probePassed = result.status === 0;
        if (!probePassed) {
            console.warn("winaudio: native module probe crashed or failed (exit", result.status + ")");
        }
    } catch {
        console.warn("winaudio: module not installed");
    }

    if (probePassed) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            winaudio = require("@librecord/winaudio");
        } catch (e) {
            probePassed = false;
            console.warn("winaudio: require failed after probe", (e as Error).message);
        }
    }

    if (!probePassed) {
        console.warn("winaudio: native module not available — registering stubs");
        // Register no-op stubs so a misconfigured install can't crash
        // callers with "No handler registered". getCapabilities can still
        // answer from os.release() even without the native module.
        const unavailable = async () => { throw new Error("winaudio unavailable"); };
        ipcMain.handle("winaudio:available",       async () => false);
        ipcMain.handle("winaudio:getCapabilities", () => {
            const build = getWindowsBuild();
            return { processLoopback: build >= 22000, windowsBuild: build };
        });
        ipcMain.handle("winaudio:startAudio",      unavailable);
        ipcMain.handle("winaudio:stopAudio",       async () => undefined);
        return;
    }

    let audioSession: AudioSessionLike | null = null;
    // Track whether the session is being torn down. The native module may
    // fire events on background threads after stop() is called; the flag
    // prevents callbacks from touching destroyed JS objects.
    let audioStopping = false;

    const closeAudio = () => {
        if (audioSession) {
            audioStopping = true;
            try { audioSession.removeAllListeners?.(); } catch { /* ignore */ }
            try { audioSession.stop(); } catch { /* ignore */ }
            audioSession = null;
        }
    };

    ipcMain.handle("winaudio:available", () => true);
    ipcMain.handle("winaudio:getCapabilities", () => {
        const build = getWindowsBuild();
        return { processLoopback: build >= 22000, windowsBuild: build };
    });

    ipcMain.handle("winaudio:startAudio", (_e, options?: { mode?: "systemLoopback" | "processLoopback"; pid?: number }) => {
        closeAudio();

        // Default behaviour: capture the system mix MINUS the Librecord
        // process tree, so the meeting we're publishing into doesn't echo
        // back to other participants. Requires Win11 22000+ (PROCESS_LOOPBACK
        // with EXCLUDE_TARGET_PROCESS_TREE). On older builds we fall back
        // to whole-device systemLoopback, which is best-effort and the
        // renderer should warn the user about.
        let ctorOpts: unknown;
        if (options?.mode === "processLoopback" && options.pid !== undefined) {
            // Renderer-supplied override (e.g. share a specific app's audio).
            ctorOpts = { mode: "processLoopback", pid: options.pid, includeTree: true };
        } else if (options?.mode === "systemLoopback") {
            ctorOpts = { mode: "systemLoopback" };
        } else if (getWindowsBuild() >= 22000) {
            // Win11 22000+: exclude the Librecord process tree so the
            // meeting we're publishing into doesn't echo back.
            ctorOpts = {
                mode: "processLoopback",
                pid: process.pid,
                includeTree: false, // EXCLUDE_TARGET_PROCESS_TREE
            };
        } else {
            ctorOpts = { mode: "systemLoopback" };
        }

        const session = new winaudio.AudioSession(ctorOpts);
        audioStopping = false;

        session.on("chunk", (chunk) => {
            if (audioStopping) return;
            try {
                const win = getMainWindow();
                if (win && !win.isDestroyed()) {
                    win.webContents.send("winaudio:audio", {
                        timestampNs: chunk.timestampNs.toString(),
                        frameCount: chunk.frameCount,
                        sampleRate: chunk.sampleRate,
                        channels: chunk.channels,
                        data: Buffer.from(chunk.data),
                    });
                }
            } catch { /* session or window destroyed during shutdown */ }
        });
        session.on("error", (err) => {
            if (audioStopping) return;
            try {
                const win = getMainWindow();
                if (win && !win.isDestroyed()) {
                    win.webContents.send("winaudio:audio-error", err);
                }
            } catch { /* ignore */ }
        });

        session.start();
        audioSession = session;
        return true;
    });

    ipcMain.handle("winaudio:stopAudio", closeAudio);

    app.on("will-quit", closeAudio);
}
