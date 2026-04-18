import { getEventBus } from "@librecord/api-client";

/**
 * Subscribe to a typed event via the platform's EventBus. Wired to window
 * CustomEvents on web and an in-memory bus on React Native. Returns a cleanup
 * function that removes the listener.
 *
 * Usage:
 *   const cleanup = onCustomEvent<{ userId: string }>("voice:user:joined", (detail) => { ... });
 *   // later: cleanup();
 */
export function onCustomEvent<T>(
    name: string,
    handler: (detail: T) => void,
): () => void {
    const bus = getEventBus();
    if (!bus) return () => {};
    return bus.on<T>(name, handler);
}

/**
 * Subscribe to a plain event (no detail). Returns a cleanup function.
 */
export function onEvent(name: string, handler: () => void): () => void {
    const bus = getEventBus();
    if (!bus) return () => {};
    return bus.onPlain(name, handler);
}
