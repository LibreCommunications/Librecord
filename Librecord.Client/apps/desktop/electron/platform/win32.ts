/**
 * Windows screen capture platform: wincap (WGC + Media Foundation +
 * WASAPI loopback).
 *
 * Surface exposed via IPC:
 *   wincap:available           → boolean
 *   wincap:getCapabilities     → wincap caps blob
 *   wincap:listSources         → { displays, windows } with stringified handles
 *   wincap:showPicker          → opens the existing screen-share picker UI
 *                                populated with wincap sources (thumbnails
 *                                pulled from desktopCapturer for parity)
 *                                and resolves to the chosen source
 *   wincap:startCapture        → constructs CaptureSession in encoded mode
 *   wincap:stopCapture
 *   wincap:requestKeyframe
 *   wincap:setBitrate
 *   wincap:startAudio          → constructs AudioSession (system loopback)
 *   wincap:stopAudio
 *
 * Source IDs in the picker are tagged so the wincap selection handler
 * can distinguish them from a desktopCapturer fallback selection:
 *
 *   screen:wincap:0xHMONITOR
 *   window:wincap:0xHWND
 *
 * The picker UI doesn't care about the format — it splits by the
 * `screen:` / `window:` prefix only.
 */

import type { App, BrowserWindow, IpcMain } from "electron";
import { desktopCapturer } from "electron";

interface WincapDisplayNative {
    monitorHandle: bigint;
    name: string;
    primary: boolean;
    bounds: { x: number; y: number; width: number; height: number };
}

interface WincapWindowNative {
    hwnd: bigint;
    title: string;
    pid: number;
    bounds: { x: number; y: number; width: number; height: number };
}

interface CaptureSessionLike {
    start(): void;
    stop(): void;
    on(event: "encoded", cb: (frame: { data: ArrayBuffer; timestampNs: bigint; keyframe: boolean }) => void): void;
    on(event: "error",   cb: (err: { component: string; hresult: number; message: string }) => void): void;
    requestKeyframe(): void;
    setBitrate(bps: number): void;
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
}

const SOURCE_PREFIX = {
    display: "screen:wincap:",
    window:  "window:wincap:",
} as const;

function encodeId(kind: "display" | "window", handle: bigint): string {
    return SOURCE_PREFIX[kind] + "0x" + handle.toString(16).toUpperCase();
}

function tryDecodeId(id: string): { kind: "display" | "window"; handle: bigint } | null {
    if (id.startsWith(SOURCE_PREFIX.display)) {
        return { kind: "display", handle: BigInt(id.slice(SOURCE_PREFIX.display.length)) };
    }
    if (id.startsWith(SOURCE_PREFIX.window)) {
        return { kind: "window", handle: BigInt(id.slice(SOURCE_PREFIX.window.length)) };
    }
    return null;
}

export function setupWindowsScreenCapture(
    app: App,
    ipcMain: IpcMain,
    getMainWindow: () => BrowserWindow | null,
): void {
    let wincap: {
        listDisplays(): WincapDisplayNative[];
        listWindows(): WincapWindowNative[];
        getCapabilities(): unknown;
        CaptureSession: new (opts: unknown) => CaptureSessionLike;
        AudioSession:   new (opts: unknown) => AudioSessionLike;
    };
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        wincap = require("@librecord/wincap");
    } catch (e) {
        console.warn("wincap: native module not available", (e as Error).message);
        // Register no-op stubs for every channel the preload exposes so a
        // misconfigured install can't crash callers with "No handler
        // registered". The renderer is expected to call available()
        // first and fall back to getDisplayMedia when it returns false.
        const unavailable = async () => { throw new Error("wincap unavailable"); };
        ipcMain.handle("wincap:available",       async () => false);
        ipcMain.handle("wincap:getCapabilities", unavailable);
        ipcMain.handle("wincap:listSources",     unavailable);
        ipcMain.handle("wincap:showPicker",      async () => null);
        ipcMain.handle("wincap:startCapture",    unavailable);
        ipcMain.handle("wincap:stopCapture",     async () => undefined);
        ipcMain.handle("wincap:requestKeyframe", async () => undefined);
        ipcMain.handle("wincap:setBitrate",      async () => undefined);
        ipcMain.handle("wincap:startAudio",      unavailable);
        ipcMain.handle("wincap:stopAudio",       async () => undefined);
        return;
    }

    let videoSession: CaptureSessionLike | null = null;
    let audioSession: AudioSessionLike | null = null;
    let abortPicker: (() => void) | null = null;

    const closeVideo = () => {
        if (videoSession) {
            try { videoSession.stop(); } catch { /* ignore */ }
            videoSession = null;
        }
    };
    const closeAudio = () => {
        if (audioSession) {
            try { audioSession.stop(); } catch { /* ignore */ }
            audioSession = null;
        }
    };

    ipcMain.handle("wincap:available", () => true);
    ipcMain.handle("wincap:getCapabilities", () => wincap.getCapabilities());

    ipcMain.handle("wincap:listSources", () => ({
        displays: wincap.listDisplays().map((d) => ({
            kind: "display" as const,
            monitorHandle: d.monitorHandle.toString(),
            name: d.name,
            primary: d.primary,
            bounds: d.bounds,
        })),
        windows: wincap.listWindows().map((w) => ({
            kind: "window" as const,
            hwnd: w.hwnd.toString(),
            title: w.title,
            pid: w.pid,
            bounds: w.bounds,
        })),
    }));

    /**
     * Show the existing screen-share picker UI populated with wincap
     * sources. Thumbnails come from desktopCapturer because wincap
     * doesn't expose a thumbnail API yet — we match by display_id (for
     * monitors) and HWND (for windows, which Electron encodes in its
     * source.id as `window:HWND:0`).
     */
    ipcMain.handle("wincap:showPicker", async () => {
        if (abortPicker) {
            abortPicker();
            abortPicker = null;
        }

        const win = getMainWindow();
        if (!win) return null;

        const [displays, windows, capturerSources] = await Promise.all([
            Promise.resolve(wincap.listDisplays()),
            Promise.resolve(wincap.listWindows()),
            desktopCapturer.getSources({
                types: ["screen", "window"],
                thumbnailSize: { width: 320, height: 180 },
                fetchWindowIcons: true,
            }),
        ]);

        // Build thumbnail lookup tables.
        const screenThumbsByDisplayId = new Map<string, { thumb: string; icon: string | null }>();
        const windowThumbsByHwnd      = new Map<string, { thumb: string; icon: string | null }>();

        for (const s of capturerSources) {
            const thumb = s.thumbnail.toDataURL();
            const icon  = s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null;
            if (s.id.startsWith("screen:") && s.display_id) {
                screenThumbsByDisplayId.set(s.display_id, { thumb, icon });
            } else if (s.id.startsWith("window:")) {
                // Electron source ID format on Windows: `window:HWND:0`
                // where HWND is the decimal pointer value.
                const m = /^window:(\d+):/.exec(s.id);
                if (m) windowThumbsByHwnd.set(m[1], { thumb, icon });
            }
        }

        const placeholder =
            "data:image/svg+xml;utf8," +
            encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><rect width='100%' height='100%' fill='#1e1f22'/><text x='50%' y='50%' fill='#5865F2' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif' font-size='14'>wincap</text></svg>`,
            );

        const serialized: Array<{
            id: string;
            name: string;
            thumbnailDataUrl: string;
            displayId: string;
            appIconDataUrl: string | null;
        }> = [];

        for (const d of displays) {
            const t = screenThumbsByDisplayId.get(String(d.monitorHandle));
            serialized.push({
                id: encodeId("display", d.monitorHandle),
                name: d.name || (d.primary ? "Primary display" : "Display"),
                thumbnailDataUrl: t?.thumb ?? placeholder,
                displayId: String(d.monitorHandle),
                appIconDataUrl: t?.icon ?? null,
            });
        }
        for (const w of windows) {
            const t = windowThumbsByHwnd.get(String(w.hwnd));
            serialized.push({
                id: encodeId("window", w.hwnd),
                name: w.title,
                thumbnailDataUrl: t?.thumb ?? placeholder,
                displayId: "",
                appIconDataUrl: t?.icon ?? null,
            });
        }

        win.webContents.send("screen-share-pick", serialized);

        return new Promise<{ kind: "display" | "window"; handle: string; name: string } | null>((resolve) => {
            const cleanup = () => {
                ipcMain.removeListener("screen-share-selected", onSelected);
                ipcMain.removeListener("screen-share-cancelled", onCancelled);
                if (abortPicker === abort) abortPicker = null;
            };
            const onSelected = (_e: Electron.IpcMainEvent, sourceId: string) => {
                const decoded = tryDecodeId(sourceId);
                if (!decoded) {
                    // Not ours (a desktopCapturer-flow selection); ignore
                    // and keep waiting. Re-attach the listener.
                    ipcMain.once("screen-share-selected", onSelected);
                    return;
                }
                cleanup();
                const meta = serialized.find((s) => s.id === sourceId);
                resolve({
                    kind: decoded.kind,
                    handle: decoded.handle.toString(),
                    name: meta?.name ?? "",
                });
            };
            const onCancelled = () => {
                cleanup();
                resolve(null);
            };
            const abort = () => {
                cleanup();
                resolve(null);
            };

            abortPicker = abort;
            ipcMain.once("screen-share-selected", onSelected);
            ipcMain.once("screen-share-cancelled", onCancelled);
        });
    });

    ipcMain.handle("wincap:startCapture", (_e, options: {
        sourceKind: "display" | "window";
        handle: string;
        fps: number;
        bitrateBps: number;
        keyframeIntervalMs?: number;
        codec?: "h264" | "hevc" | "av1";
    }) => {
        closeVideo();

        const handle = BigInt(options.handle);
        const source = options.sourceKind === "display"
            ? { kind: "display" as const, monitorHandle: handle }
            : { kind: "window"  as const, hwnd: handle };

        const session = new wincap.CaptureSession({
            source,
            delivery: {
                type: "encoded",
                codec: options.codec ?? "h264",
                bitrateBps: options.bitrateBps,
                fps: options.fps,
                keyframeIntervalMs: options.keyframeIntervalMs ?? 2000,
            },
        });

        session.on("encoded", (frame) => {
            getMainWindow()?.webContents.send("wincap:encoded", {
                data: Buffer.from(frame.data),
                timestampNs: frame.timestampNs.toString(),
                keyframe: frame.keyframe,
            });
        });
        session.on("error", (err) => {
            getMainWindow()?.webContents.send("wincap:error", err);
        });

        session.start();
        videoSession = session;
        return true;
    });

    ipcMain.handle("wincap:stopCapture", closeVideo);
    ipcMain.handle("wincap:requestKeyframe", () => videoSession?.requestKeyframe());
    ipcMain.handle("wincap:setBitrate", (_e, bps: number) => videoSession?.setBitrate(bps));

    ipcMain.handle("wincap:startAudio", (_e, options?: { mode?: "systemLoopback" | "processLoopback"; pid?: number }) => {
        closeAudio();

        // Default behaviour: capture the system mix MINUS the Librecord
        // process tree, so the meeting we're publishing into doesn't
        // echo back to other participants. This requires Win11 22000+
        // (PROCESS_LOOPBACK with EXCLUDE_TARGET_PROCESS_TREE). On older
        // builds we fall back to whole-device systemLoopback, which is
        // best-effort and the renderer should warn the user about.
        let ctorOpts: unknown;
        if (options?.mode === "processLoopback" && options.pid !== undefined) {
            // Renderer-supplied override (e.g. share a specific app's audio).
            ctorOpts = { mode: "processLoopback", pid: options.pid, includeTree: true };
        } else if (options?.mode === "systemLoopback") {
            ctorOpts = { mode: "systemLoopback" };
        } else {
            const caps = wincap.getCapabilities() as { processLoopback?: boolean };
            if (caps?.processLoopback) {
                ctorOpts = {
                    mode: "processLoopback",
                    pid: process.pid,
                    includeTree: false, // EXCLUDE_TARGET_PROCESS_TREE
                };
            } else {
                ctorOpts = { mode: "systemLoopback" };
            }
        }

        const session = new wincap.AudioSession(ctorOpts);

        session.on("chunk", (chunk) => {
            getMainWindow()?.webContents.send("wincap:audio", {
                timestampNs: chunk.timestampNs.toString(),
                frameCount: chunk.frameCount,
                sampleRate: chunk.sampleRate,
                channels: chunk.channels,
                data: Buffer.from(chunk.data),
            });
        });
        session.on("error", (err) => {
            getMainWindow()?.webContents.send("wincap:audio-error", err);
        });

        session.start();
        audioSession = session;
        return true;
    });

    ipcMain.handle("wincap:stopAudio", closeAudio);

    app.on("will-quit", () => {
        closeVideo();
        closeAudio();
    });
}
