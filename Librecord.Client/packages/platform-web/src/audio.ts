import type { AudioService } from "@librecord/platform";

export const webAudio: AudioService = {
    playUrl(url) {
        const audio = new Audio(url);
        audio.play().catch(() => {});
    },

    playBuffer(buffer, contentType) {
        const blob = new Blob([buffer], { type: contentType });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play().catch(() => {});
        audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    },
};
