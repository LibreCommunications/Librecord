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
 * Logs all requests for debugging.
 */
export async function fetchWithAuth(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
    const method = options.method ?? "GET";
    const short = url.replace(/.*\/api\//, "/");
    const t0 = performance.now();

    console.debug(`[fetch] ${method} ${short}`);

    // First attempt
    const res = await fetch(url, {
        ...options,
        credentials: "include",
    });

    const ms = Math.round(performance.now() - t0);

    if (res.status !== 401) {
        if (!res.ok) console.warn(`[fetch] ${method} ${short} → ${res.status} (${ms}ms)`);
        else console.debug(`[fetch] ${method} ${short} → ${res.status} (${ms}ms)`);
        return res;
    }

    // 401 — try refresh (coalesced)
    console.debug(`[fetch] ${method} ${short} → 401, refreshing token...`);
    const refreshed = await refreshOnce();

    if (!refreshed) {
        console.warn(`[fetch] ${method} ${short} → refresh failed, giving up`);
        return res;
    }

    // Retry original request
    console.debug(`[fetch] ${method} ${short} → retrying after refresh`);
    const t1 = performance.now();
    const retryRes = await fetch(url, {
        ...options,
        credentials: "include",
    });
    const ms2 = Math.round(performance.now() - t1);
    console.debug(`[fetch] ${method} ${short} → ${retryRes.status} (${ms2}ms, retry)`);

    return retryRes;
}
