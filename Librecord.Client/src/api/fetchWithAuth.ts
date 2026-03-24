type RefreshFn = () => Promise<boolean>;

let _refreshAccessToken: RefreshFn = async () => false;

/** Called once by AuthProvider to register the refresh function. */
export function setRefreshFunction(fn: RefreshFn) {
    _refreshAccessToken = fn;
}

/**
 * Fetch with automatic 401 retry via token refresh.
 * No longer requires auth as a parameter — uses the globally registered refresh function.
 */
export async function fetchWithAuth(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
    // First attempt
    const res = await fetch(url, {
        ...options,
        credentials: "include",
    });

    if (res.status !== 401) return res;

    // Try refresh
    const refreshed = await _refreshAccessToken();
    if (!refreshed) return res;

    // Retry original request
    return await fetch(url, {
        ...options,
        credentials: "include",
    });
}
