import type { LifecycleService } from "@librecord/platform";

export const webLifecycle: LifecycleService = {
    onBeforeUnload(handler) {
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    },

    hasFocus: () => document.hasFocus(),

    onFocusChange(handler) {
        const onFocus = () => handler(true);
        const onBlur = () => handler(false);
        window.addEventListener("focus", onFocus);
        window.addEventListener("blur", onBlur);
        return () => {
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("blur", onBlur);
        };
    },

    getPathname: () => window.location.pathname,
    replaceState: (url) => window.history.replaceState(null, "", url),
    reload: () => window.location.reload(),
    focus: () => window.focus(),
};
