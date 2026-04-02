import type { NotificationService } from "@librecord/platform";

export const webNotifications: NotificationService = {
    isSupported: () => "Notification" in window,

    requestPermission: async () => {
        if (!("Notification" in window)) return "denied";
        return Notification.requestPermission();
    },

    show(title, options) {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        const n = new Notification(title, { body: options?.body, icon: options?.icon });
        if (options?.onClick) {
            n.onclick = () => {
                window.focus();
                options.onClick!();
            };
        }
    },
};
