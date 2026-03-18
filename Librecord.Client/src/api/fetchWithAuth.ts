import { useAuth } from "../context/AuthContext";

export async function fetchWithAuth(
    url: string,
    options: any = {},
    auth: ReturnType<typeof useAuth>
) {
    const { refreshAccessToken } = auth;

    // First attempt
    let res = await fetch(url, {
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
