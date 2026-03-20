/**
 * Browser notification + sound system.
 *
 * Listens for dm:message:new and guild:message:new events
 * and shows desktop notifications + plays a sound when the
 * tab is not focused.
 */

let permissionGranted = false;
let currentUserId: string | null = null;

// ─── AUDIO ──────────────────────────────────────────────────────────
// Single shared AudioContext, resumed on first user interaction.
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    return audioCtx;
}

// Resume AudioContext on first user interaction (browser requirement)
function unlockAudio() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
        ctx.resume();
    }
}

// Unlock on any user gesture — only needs to succeed once
for (const evt of ["click", "keydown", "touchstart"] as const) {
    document.addEventListener(evt, unlockAudio, { once: false, passive: true });
}

function playNotificationSound() {
    try {
        const ctx = getAudioContext();
        if (ctx.state === "suspended") return; // Not yet unlocked

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(660, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    } catch {
        // AudioContext not available
    }
}

// ─── LISTENERS ──────────────────────────────────────────────────────

let dmListener: EventListener | null = null;
let guildListener: EventListener | null = null;

export function initNotifications(userId: string) {
    cleanupNotifications();

    currentUserId = userId;

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then(perm => {
            permissionGranted = perm === "granted";
        });
    } else {
        permissionGranted = Notification.permission === "granted";
    }

    dmListener = ((e: CustomEvent) => {
        const { channelId, authorId, authorName } = e.detail;
        if (authorId === currentUserId) return;
        // Skip if we're focused on this exact channel
        if (document.hasFocus() && isViewingChannel(channelId)) return;
        playNotificationSound();
        if (!document.hasFocus()) {
            showDesktopNotification(authorName, "sent you a message");
        }
    }) as EventListener;
    window.addEventListener("dm:message:ping", dmListener);

    guildListener = ((e: CustomEvent) => {
        const { channelId, authorId, authorName } = e.detail;
        if (authorId === currentUserId) return;
        // Skip if we're focused on this exact channel
        if (document.hasFocus() && isViewingChannel(channelId)) return;
        playNotificationSound();
        if (!document.hasFocus()) {
            showDesktopNotification(authorName, "sent a message");
        }
    }) as EventListener;
    window.addEventListener("guild:message:ping", guildListener);
}

export function cleanupNotifications() {
    if (dmListener) {
        window.removeEventListener("dm:message:ping", dmListener);
        dmListener = null;
    }
    if (guildListener) {
        window.removeEventListener("guild:message:ping", guildListener);
        guildListener = null;
    }
    currentUserId = null;
}

/** Check if the user is currently viewing a specific channel. */
function isViewingChannel(channelId: string): boolean {
    const path = window.location.pathname;
    return path.includes(channelId);
}

function showDesktopNotification(title: string, body: string) {
    if (!permissionGranted) return;

    try {
        const notification = new Notification(title, {
            body: body.length > 100 ? body.slice(0, 100) + "..." : body,
            icon: "/favicon.ico",
            silent: true,
        });

        setTimeout(() => notification.close(), 5000);

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    } catch {
        // Notifications may not be available
    }
}
