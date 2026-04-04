export interface NotificationService {
    isSupported(): boolean;
    requestPermission(): Promise<"granted" | "denied" | "default">;
    show(title: string, options?: { body?: string; icon?: string; channelId?: string; onClick?: () => void }): void;
}
