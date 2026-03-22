import { useAuth } from "../hooks/useAuth";

export async function fetchWithAuth(
    url: string,
    options: RequestInit = {},
    auth: ReturnType<typeof useAuth>
) {
    const { refreshAccessToken } = auth;

    // First attempt
    const res = await fetch(url, {
        ...options,
        credentials: "include",
    });

    if (res.status !== 401) return res;

    // Try refresh
    const refreshed = await refreshAccessToken();
    if (!refreshed) return res;

    // Retry original request
    return await fetch(url, {
        ...options,
        credentials: "include",
    });
}
