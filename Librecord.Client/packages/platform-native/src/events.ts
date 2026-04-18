import type { EventBus } from "@librecord/platform";

type Handler = (detail: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

function subscribe(event: string, handler: Handler): () => void {
    let set = listeners.get(event);
    if (!set) {
        set = new Set();
        listeners.set(event, set);
    }
    set.add(handler);
    return () => {
        set!.delete(handler);
        if (set!.size === 0) listeners.delete(event);
    };
}

export const nativeEventBus: EventBus = {
    on<T>(event: string, handler: (detail: T) => void): () => void {
        return subscribe(event, handler as Handler);
    },

    onPlain(event, handler) {
        return subscribe(event, handler as Handler);
    },

    dispatch<T>(event: string, detail: T): void {
        const set = listeners.get(event);
        if (!set) return;
        for (const handler of set) handler(detail);
    },

    dispatchPlain(event) {
        const set = listeners.get(event);
        if (!set) return;
        for (const handler of set) handler(undefined);
    },
};
