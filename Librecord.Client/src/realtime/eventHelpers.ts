import type { AppEventMap } from "./events";

export function dispatchAppEvent<K extends keyof AppEventMap>(
    type: K,
    detail: AppEventMap[K],
) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
}
