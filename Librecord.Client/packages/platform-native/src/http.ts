import type { HttpClient } from "@librecord/platform";

// React Native's global fetch honors Set-Cookie via the native HTTP stack on
// Android and iOS, so `credentials: "include"` (a browser concept) isn't needed.
// If cookie persistence across app restarts becomes a problem we'll integrate
// @react-native-cookies/cookies here.
export const nativeHttpClient: HttpClient = {
    fetch: (url, options) => fetch(url, options),
};
