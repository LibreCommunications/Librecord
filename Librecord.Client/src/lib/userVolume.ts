import { STORAGE } from "./storageKeys";

export function getUserVolume(userId: string): number {
    try {
        const vols = JSON.parse(localStorage.getItem(STORAGE.userVolumes) ?? "{}");
        return vols[userId] ?? 100;
    } catch { return 100; }
}

export function setUserVolume(userId: string, volume: number) {
    try {
        const vols = JSON.parse(localStorage.getItem(STORAGE.userVolumes) ?? "{}");
        vols[userId] = volume;
        localStorage.setItem(STORAGE.userVolumes, JSON.stringify(vols));
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("voice:volume:changed", { detail: { userId, volume } }));
}
