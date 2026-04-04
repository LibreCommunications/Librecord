import type { NotificationService } from "@librecord/platform";
import { getElectronAPI } from "@librecord/domain";

export const electronNotifications: NotificationService = {
    isSupported: () => !!getElectronAPI(),

    requestPermission: async () => "granted",

    show(title, options) {
        getElectronAPI()?.showNotification({
            title,
            body: options?.body ?? "",
            channelId: options?.channelId,
        });
    },
};
