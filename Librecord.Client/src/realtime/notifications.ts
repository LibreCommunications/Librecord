/**
 * Browser notification + sound system.
 *
 * Listens for dm:message:new and guild:message:new events
 * and shows desktop notifications + plays a sound when the
 * tab is not focused.
 */

let permissionGranted = false;
let currentUserId: string | null = null;

// Notification sound — short blip
const notificationSound = new Audio("data:audio/wav;base64,UklGRl9vT19teleWQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==");

export function initNotifications(userId: string) {
    currentUserId = userId;

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then(perm => {
            permissionGranted = perm === "granted";
        });
    } else {
        permissionGranted = Notification.permission === "granted";
    }

    // DM messages
    window.addEventListener("dm:message:new", ((e: CustomEvent) => {
        const { message } = e.detail;
        if (message.author.id === currentUserId) return;
        if (document.hasFocus()) return;

        showNotification(
            message.author.displayName,
            message.content,
        );
    }) as EventListener);

    // Guild messages
    window.addEventListener("guild:message:new", ((e: CustomEvent) => {
        const { message } = e.detail;
        if (message.author.id === currentUserId) return;
        if (document.hasFocus()) return;

        showNotification(
            message.author.displayName,
            message.content,
        );
    }) as EventListener);
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
