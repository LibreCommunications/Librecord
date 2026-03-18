import type { DmEventMap } from "./dmEvents";

export function dispatchDmEvent<K extends keyof DmEventMap>(
    type: K,
    detail: DmEventMap[K]
) {
    window.dispatchEvent(
        new CustomEvent(type, { detail })
    );
}
