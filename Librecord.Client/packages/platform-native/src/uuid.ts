import type { UUIDGenerator } from "@librecord/platform";

// RFC 4122 v4 — Math.random is fine for the non-security use (clientMessageId, etc.).
// If we ever need crypto-strength IDs on RN we'll add react-native-get-random-values
// and swap this out.
export const nativeUUID: UUIDGenerator = {
    generate() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    },
};
