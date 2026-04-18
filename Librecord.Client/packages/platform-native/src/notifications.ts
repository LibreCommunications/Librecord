import type { NotificationService } from "@librecord/platform";

// Stub until we integrate @notifee/react-native. The shared code is guarded by
// isSupported() so no-op here is safe.
export const nativeNotifications: NotificationService = {
    isSupported: () => false,
    requestPermission: async () => "denied",
    show: () => {},
};
