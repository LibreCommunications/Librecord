import { MMKV } from "react-native-mmkv";
import type { StorageAdapter, SessionStorageAdapter } from "@librecord/platform";

const persistent = new MMKV({ id: "librecord.persistent" });

export const nativeStorage: StorageAdapter = {
    get: (key) => persistent.getString(key) ?? null,
    set: (key, value) => persistent.set(key, value),
    remove: (key) => persistent.delete(key),
};

// RN has no session concept; keep an in-memory Map that clears on relaunch.
const session = new Map<string, string>();

export const nativeSessionStorage: SessionStorageAdapter = {
    get: (key) => session.get(key) ?? null,
    set: (key, value) => { session.set(key, value); },
    remove: (key) => { session.delete(key); },
};
