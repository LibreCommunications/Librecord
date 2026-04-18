// Resolve public asset paths relative to the platform's base URL.
// Web uses base="/", desktop uses base="./" (file:// protocol). Metro/React
// Native has no BASE_URL concept, so we fall back to "/" on mobile.
declare const __VITE_BASE__: string | undefined;
const BASE =
    (typeof __VITE_BASE__ !== "undefined" && __VITE_BASE__) ||
    (typeof globalThis !== "undefined" && (globalThis as { __BASE_URL__?: string }).__BASE_URL__) ||
    "/";

export function assetUrl(path: string): string {
    // Strip leading slash so it joins cleanly with base
    const clean = path.startsWith("/") ? path.slice(1) : path;
    return `${BASE}${clean}`;
}

export const DEFAULT_AVATAR = assetUrl("default-avatar.png");
