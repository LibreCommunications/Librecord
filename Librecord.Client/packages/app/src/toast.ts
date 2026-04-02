import type { ToastType } from "./context/ToastContext.tsx";

/**
 * Show a toast from anywhere (including non-React modules like livekitClient).
 * The ToastProvider listens for this event and displays the toast.
 */
export function showToast(message: string, type: ToastType = "info") {
    window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, type } }));
}
