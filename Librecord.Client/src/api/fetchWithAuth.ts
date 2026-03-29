import { logger } from "../lib/logger";

type RefreshFn = () => Promise<boolean>;

let _refreshAccessToken: RefreshFn = async () => false;
let _refreshPromise: Promise<boolean> | null = null;

export function setRefreshFunction(fn: RefreshFn) {
    _refreshAccessToken = fn;
}

async function refreshOnce(): Promise<boolean> {
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = _refreshAccessToken().finally(() => {
        _refreshPromise = null;
    });

    return _refreshPromise;
}

export async function fetchWithAuth(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
    const res = await fetch(url, {
        ...options,
        credentials: "include",
    });

    if (res.status !== 401) {
        return res;
    }

    const refreshed = await refreshOnce();

    if (!refreshed) {
        logger.api.warn("Token refresh failed");
        return res;
    }

    const retryRes = await fetch(url, {
        ...options,
        credentials: "include",
    });

    return retryRes;
}
