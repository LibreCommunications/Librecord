import type { AppEventMap } from "@librecord/domain";
import type { EventBus } from "@librecord/platform";

let _eventBus: EventBus | null = null;

export function setEventBus(bus: EventBus) {
    _eventBus = bus;
}

export function getEventBus(): EventBus | null {
    return _eventBus;
}

export function dispatchAppEvent<K extends keyof AppEventMap>(
    type: K,
    detail: AppEventMap[K],
) {
    _eventBus?.dispatch(type, detail);
}
