import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Listens for `app:auth:revoked` (dispatched by the SignalR session
 * revocation handler) and navigates to /login via React Router.
 *
 * Why not just `window.location.href = "/login"` inside listeners.ts?
 * Because the packaged Electron app runs from `file://.../index.html`,
 * so assigning location.href tries to load `file:///login` and fails
 * with "Not allowed to load local resource". Router-aware navigation
 * via `navigate()` works correctly in both web and Electron builds.
 */
export function AuthRevocationHandler() {
    const navigate = useNavigate();

    useEffect(() => {
        const handler = () => navigate("/login", { replace: true });
        window.addEventListener("app:auth:revoked", handler);
        return () => window.removeEventListener("app:auth:revoked", handler);
    }, [navigate]);

    return null;
}
