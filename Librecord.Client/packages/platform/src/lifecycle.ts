export interface LifecycleService {
    onBeforeUnload(handler: () => void): () => void;
    hasFocus(): boolean;
    onFocusChange(handler: (focused: boolean) => void): () => void;
    getPathname(): string;
    replaceState(url: string): void;
    reload(): void;
    focus(): void;
}
