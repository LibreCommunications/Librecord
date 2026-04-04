// Resolve public asset paths relative to Vite's base URL.
// Web uses base="/", desktop uses base="./" (file:// protocol).
const BASE = import.meta.env.BASE_URL ?? "/";

export function assetUrl(path: string): string {
    // Strip leading slash so it joins cleanly with base
    const clean = path.startsWith("/") ? path.slice(1) : path;
    return `${BASE}${clean}`;
}

export const DEFAULT_AVATAR = assetUrl("default-avatar.png");
