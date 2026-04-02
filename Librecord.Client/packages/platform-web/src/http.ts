import type { HttpClient } from "@librecord/platform";

export const webHttpClient: HttpClient = {
    fetch: (url, options) => fetch(url, { ...options, credentials: "include" }),
};
