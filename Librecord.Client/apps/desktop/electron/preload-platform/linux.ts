/**
 * Linux preload bridge: pipecap + pipecapShm exposure.
 */

import { contextBridge, ipcRenderer } from "electron";
import * as fs from "fs";

export function exposeLinux(): void {
    contextBridge.exposeInMainWorld("pipecap", {
        available: () => ipcRenderer.invoke("pipecap:available"),
        showPicker: (sourceTypes?: number) => ipcRenderer.invoke("pipecap:showPicker", sourceTypes),
        startCapture: (options: Record<string, unknown>) => ipcRenderer.invoke("pipecap:startCapture", options),
        stopCapture: () => ipcRenderer.invoke("pipecap:stopCapture"),
        isCapturing: () => ipcRenderer.invoke("pipecap:isCapturing"),
        listAudioApps: () => ipcRenderer.invoke("pipecap:listAudioApps"),
        setAudioTarget: (target: string) => ipcRenderer.invoke("pipecap:setAudioTarget", target),
        onAudio: (callback: (audio: { channels: number; sampleRate: number; data: Buffer }) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, audio: { channels: number; sampleRate: number; data: Buffer }) => callback(audio);
            ipcRenderer.on("pipecap:audio", handler);
            return () => ipcRenderer.removeListener("pipecap:audio", handler);
        },
    });

    let shmFd: number | null = null;
    let lastSeq = BigInt(0);

    contextBridge.exposeInMainWorld("pipecapShm", {
        open: (shmPath: string) => {
            try {
                shmFd = fs.openSync(shmPath, "r");
                lastSeq = BigInt(0);
                return true;
            } catch {
                return false;
            }
        },
        readFrame: (): { width: number; height: number; stride: number; data: ArrayBuffer } | null => {
            if (shmFd === null) return null;
            const headerBuf = Buffer.alloc(32);
            fs.readSync(shmFd, headerBuf, 0, 32, 0);
            const seq = headerBuf.readBigUInt64LE(0);
            if (seq === lastSeq) return null;
            lastSeq = seq;
            const width = headerBuf.readUInt32LE(8);
            const height = headerBuf.readUInt32LE(12);
            const stride = headerBuf.readUInt32LE(16);
            const dataOffset = headerBuf.readUInt32LE(20);
            const dataSize = headerBuf.readUInt32LE(24);
            if (width === 0 || height === 0 || dataSize === 0) return null;
            const frameBuf = Buffer.alloc(dataSize);
            fs.readSync(shmFd, frameBuf, 0, dataSize, dataOffset);
            return {
                width,
                height,
                stride,
                data: frameBuf.buffer.slice(frameBuf.byteOffset, frameBuf.byteOffset + frameBuf.byteLength),
            };
        },
        close: () => {
            if (shmFd !== null) {
                try { fs.closeSync(shmFd); } catch { /* ignore */ }
                shmFd = null;
            }
        },
    });
}
