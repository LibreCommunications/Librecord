// Simple in-memory TTL cache for GET API requests.
// Deduplicates in-flight requests so concurrent calls to the same URL share one fetch.

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL = 30_000; // 30 seconds

export function cached<T>(key: string, fetcher: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
    // Return cached data if still fresh
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    if (entry && entry.expiresAt > Date.now()) {
        return Promise.resolve(entry.data);
    }

    // Deduplicate in-flight requests
    const pending = inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = fetcher().then(data => {
        cache.set(key, { data, expiresAt: Date.now() + ttl });
        inflight.delete(key);
        return data;
    }).catch(err => {
        inflight.delete(key);
        throw err;
    });

    inflight.set(key, promise);
    return promise;
}

export function invalidate(keyOrPrefix: string) {
    if (keyOrPrefix.endsWith("*")) {
        const prefix = keyOrPrefix.slice(0, -1);
        for (const key of cache.keys()) {
            if (key.startsWith(prefix)) cache.delete(key);
        }
    } else {
        cache.delete(keyOrPrefix);
    }
}

export function invalidateAll() {
    cache.clear();
}
