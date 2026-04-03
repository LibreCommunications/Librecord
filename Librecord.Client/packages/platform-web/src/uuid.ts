import type { UUIDGenerator } from "@librecord/platform";

export const webUUID: UUIDGenerator = {
    generate: () => crypto.randomUUID(),
};
