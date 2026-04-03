import type { EventBus } from "@librecord/platform";

export const webEventBus: EventBus = {
    on<T>(event: string, handler: (detail: T) => void): () => void {
        const listener = (e: Event) => handler((e as CustomEvent<T>).detail);
        window.addEventListener(event, listener);
        return () => window.removeEventListener(event, listener);
    },

    onPlain(event: string, handler: () => void): () => void {
        window.addEventListener(event, handler);
        return () => window.removeEventListener(event, handler);
    },

    dispatch<T>(event: string, detail: T): void {
        window.dispatchEvent(new CustomEvent(event, { detail }));
    },

    dispatchPlain(event: string): void {
        window.dispatchEvent(new Event(event));
    },
};
