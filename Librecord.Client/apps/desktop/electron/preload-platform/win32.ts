/**
 * Windows preload bridge: wincap exposure (video + audio + picker).
 */

import { contextBridge, ipcRenderer } from "electron";

export function exposeWindows(): void {
    contextBridge.exposeInMainWorld("wincap", {
        available: () => ipcRenderer.invoke("wincap:available"),
        getCapabilities: () => ipcRenderer.invoke("wincap:getCapabilities"),
        listSources: () => ipcRenderer.invoke("wincap:listSources"),

        showPicker: () => ipcRenderer.invoke("wincap:showPicker"),

        startCapture: (options: {
            sourceKind: "display" | "window";
            handle: string;
            fps: number;
            bitrateBps: number;
            keyframeIntervalMs?: number;
            codec?: "h264" | "hevc" | "av1";
        }) => ipcRenderer.invoke("wincap:startCapture", options),
        stopCapture: () => ipcRenderer.invoke("wincap:stopCapture"),
        requestKeyframe: () => ipcRenderer.invoke("wincap:requestKeyframe"),
        setBitrate: (bps: number) => ipcRenderer.invoke("wincap:setBitrate", bps),

        startAudio: (options?: { mode?: "systemLoopback" | "processLoopback"; pid?: number }) =>
            ipcRenderer.invoke("wincap:startAudio", options),
        stopAudio: () => ipcRenderer.invoke("wincap:stopAudio"),

        onEncoded: (cb: (frame: { data: Buffer; timestampNs: string; keyframe: boolean }) => void) => {
            const handler = (_e: Electron.IpcRendererEvent, frame: { data: Buffer; timestampNs: string; keyframe: boolean }) => cb(frame);
            ipcRenderer.on("wincap:encoded", handler);
            return () => ipcRenderer.removeListener("wincap:encoded", handler);
        },
        onError: (cb: (err: { component: string; hresult: number; message: string }) => void) => {
            const handler = (_e: Electron.IpcRendererEvent, err: { component: string; hresult: number; message: string }) => cb(err);
            ipcRenderer.on("wincap:error", handler);
            return () => ipcRenderer.removeListener("wincap:error", handler);
        },
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
            ipcRenderer.on("wincap:audio", handler);
            return () => ipcRenderer.removeListener("wincap:audio", handler);
        },
        onAudioError: (cb: (err: unknown) => void) => {
            const handler = (_e: Electron.IpcRendererEvent, err: unknown) => cb(err);
            ipcRenderer.on("wincap:audio-error", handler);
            return () => ipcRenderer.removeListener("wincap:audio-error", handler);
        },
    });
}
