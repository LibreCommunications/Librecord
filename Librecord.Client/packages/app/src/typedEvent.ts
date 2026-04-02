/**
 * Subscribe to a typed CustomEvent on `window`.
 * Returns a cleanup function that removes the listener.
 *
 * Usage:
 *   const cleanup = onCustomEvent<{ userId: string }>("voice:user:joined", (detail) => { ... });
 *   // later: cleanup();
 */
export function onCustomEvent<T>(
    name: string,
    handler: (detail: T) => void,
): () => void {
    const listener = (e: Event) => handler((e as CustomEvent<T>).detail);
    window.addEventListener(name, listener);
    return () => window.removeEventListener(name, listener);
}

/**
 * Subscribe to a plain Event (no detail) on `window`.
 * Returns a cleanup function.
 */
export function onEvent(name: string, handler: () => void): () => void {
    window.addEventListener(name, handler);
    return () => window.removeEventListener(name, handler);
}
