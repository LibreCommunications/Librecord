/**
 * Browser notification + sound system.
 *
 * Listens for dm:message:new and guild:message:new events
 * and shows desktop notifications + plays a sound when the
 * tab is not focused.
 */

let permissionGranted = false;
let currentUserId: string | null = null;

// Notification sound — short blip (440Hz sine, 150ms)
const notificationSound = (() => {
    const ctx = new OfflineAudioContext(1, 7200, 48000);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 440;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(0);
    osc.stop(0.15);
    const audio = new Audio();
    ctx.startRendering().then(buffer => {
        const wav = audioBufferToWav(buffer);
        audio.src = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    });
    return audio;
})();

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = 1;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.getChannelData(0);
    const byteRate = sampleRate * numChannels * 2;
    const dataSize = samples.length * 2;
    const headerSize = 44;
    const buf = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buf);

    function writeString(offset: number, str: string) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(headerSize + i * 2, s * 0x7FFF, true);
    }

    return buf;
}

// Track listener references so we can remove them
let dmListener: EventListener | null = null;
let guildListener: EventListener | null = null;

export function initNotifications(userId: string) {
    // Clean up any previous listeners first
    cleanupNotifications();

    currentUserId = userId;

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then(perm => {
            permissionGranted = perm === "granted";
        });
    } else {
        permissionGranted = Notification.permission === "granted";
    }

    // DM messages
    dmListener = ((e: CustomEvent) => {
        const { message } = e.detail;
        if (message.author.id === currentUserId) return;
        if (document.hasFocus()) return;

        showNotification(
            message.author.displayName,
            message.content,
        );
    }) as EventListener;
    window.addEventListener("dm:message:new", dmListener);

    // Guild messages
    guildListener = ((e: CustomEvent) => {
        const { message } = e.detail;
        if (message.author.id === currentUserId) return;
        if (document.hasFocus()) return;

        showNotification(
            message.author.displayName,
            message.content,
        );
    }) as EventListener;
    window.addEventListener("guild:message:new", guildListener);
}

export function cleanupNotifications() {
    if (dmListener) {
        window.removeEventListener("dm:message:new", dmListener);
        dmListener = null;
    }
    if (guildListener) {
        window.removeEventListener("guild:message:new", guildListener);
        guildListener = null;
    }
    currentUserId = null;
}

function showNotification(title: string, body: string) {
    // Play sound
    notificationSound.currentTime = 0;
    notificationSound.volume = 0.3;
    notificationSound.play().catch(() => {});

    // Desktop notification
    if (!permissionGranted) return;

    try {
        const notification = new Notification(title, {
            body: body.length > 100 ? body.slice(0, 100) + "..." : body,
            icon: "/favicon.ico",
            silent: true, // we handle sound ourselves
        });

        // Auto-close after 5s
        setTimeout(() => notification.close(), 5000);

        // Focus window on click
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    } catch {
        // Notifications may not be available
    }
}
