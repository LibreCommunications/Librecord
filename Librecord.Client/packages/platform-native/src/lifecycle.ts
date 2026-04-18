import { AppState, DevSettings } from "react-native";
import type { LifecycleService } from "@librecord/platform";

export const nativeLifecycle: LifecycleService = {
    // RN has no true beforeunload; background transition is the closest analogue.
    onBeforeUnload(handler) {
        const sub = AppState.addEventListener("change", (state) => {
            if (state === "background" || state === "inactive") handler();
        });
        return () => sub.remove();
    },

    hasFocus: () => AppState.currentState === "active",

    onFocusChange(handler) {
        const sub = AppState.addEventListener("change", (state) => {
            handler(state === "active");
        });
        return () => sub.remove();
    },

    // No URL concept in RN — these are no-ops so shared code that touches them doesn't crash.
    getPathname: () => "",
    replaceState: () => {},
    reload: () => {
        if (__DEV__) DevSettings.reload();
    },
    focus: () => {},
};
