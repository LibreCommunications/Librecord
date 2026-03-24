type RefreshFn = () => Promise<boolean>;

let _refreshAccessToken: RefreshFn = async () => false;
let _refreshPromise: Promise<boolean> | null = null;

/** Called once by AuthProvider to register the refresh function. */
export function setRefreshFunction(fn: RefreshFn) {
    _refreshAccessToken = fn;
}

/**
 * Coalesces concurrent refresh calls — if a refresh is already in-flight,
 * subsequent callers wait for the same promise instead of firing another.
 */
async function refreshOnce(): Promise<boolean> {
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = _refreshAccessToken().finally(() => {
        _refreshPromise = null;
    });

    return _refreshPromise;
}

/**
 * Fetch with automatic 401 retry via token refresh.
 * Uses a globally registered refresh function (set by AuthProvider).
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

    if (res.status !== 401) {
        return res;
    }

    // 401 — try refresh (coalesced)
    const refreshed = await refreshOnce();

    if (!refreshed) {
        console.warn("[fetch] token refresh failed");
        return res;
    }

    // Retry original request
    const retryRes = await fetch(url, {
        ...options,
        credentials: "include",
    });

    return retryRes;
}
