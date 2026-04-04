import type { NotificationService } from "@librecord/platform";

export const electronNotifications: NotificationService = {
    isSupported: () => !!window.electronAPI,

    requestPermission: async () => "granted",

    show(title, options) {
        window.electronAPI?.showNotification({
            title,
            body: options?.body ?? "",
            channelId: options?.channelId,
        });
    },
};
