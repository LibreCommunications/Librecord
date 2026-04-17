/**
 * Windows preload bridge: winaudio exposure (WASAPI loopback audio only).
 *
 * Video capture on Windows flows through Chromium's getDisplayMedia —
 * no bridge needed here for video.
 */

import { contextBridge, ipcRenderer } from "electron";

export function exposeWindows(): void {
    contextBridge.exposeInMainWorld("winaudio", {
        available: () => ipcRenderer.invoke("winaudio:available"),
        getCapabilities: () => ipcRenderer.invoke("winaudio:getCapabilities"),

        startAudio: (options?: { mode?: "systemLoopback" | "processLoopback"; pid?: number }) =>
            ipcRenderer.invoke("winaudio:startAudio", options),
        stopAudio: () => ipcRenderer.invoke("winaudio:stopAudio"),

        onAudio: (cb: (chunk: {
            timestampNs: string;
            frameCount: number;
            sampleRate: number;
            channels: number;
            data: Buffer;
        }) => void) => {
            const handler = (
                _e: Electron.IpcRendererEvent,
                chunk: { timestampNs: string; frameCount: number; sampleRate: number; channels: number; data: Buffer },
            ) => cb(chunk);
            ipcRenderer.on("winaudio:audio", handler);
            return () => ipcRenderer.removeListener("winaudio:audio", handler);
        },
        onAudioError: (cb: (err: unknown) => void) => {
            const handler = (_e: Electron.IpcRendererEvent, err: unknown) => cb(err);
            ipcRenderer.on("winaudio:audio-error", handler);
            return () => ipcRenderer.removeListener("winaudio:audio-error", handler);
        },
    });
}
