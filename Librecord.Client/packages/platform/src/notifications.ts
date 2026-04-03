export interface NotificationService {
    isSupported(): boolean;
    requestPermission(): Promise<"granted" | "denied" | "default">;
    show(title: string, options?: { body?: string; icon?: string; onClick?: () => void }): void;
}
