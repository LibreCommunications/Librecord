// Listens to real-time events and invalidates the API cache so users
// see fresh data immediately instead of waiting for TTL expiry.

import { onCustomEvent, onEvent } from "./typedEvent";
import { invalidate } from "./apiCache";
import type { AppEventMap } from "../realtime/events";

export function initCacheInvalidation(): () => void {
    const cleanups = [
        // Guild changes
        onCustomEvent<AppEventMap["guild:updated"]>("guild:updated", (d) => {
            invalidate("guilds");
            invalidate(`guild:${d.guildId}`);
        }),
        onCustomEvent<AppEventMap["guild:deleted"]>("guild:deleted", (d) => {
            invalidate("guilds");
            invalidate(`guild:${d.guildId}*`);
        }),
        onCustomEvent<AppEventMap["guild:channel:created"]>("guild:channel:created", (d) => {
            invalidate(`guild:${d.guildId}:channels`);
        }),
        onCustomEvent<AppEventMap["guild:channel:updated"]>("guild:channel:updated", (d) => {
            invalidate(`guild:${d.guildId}:channels`);
            invalidate(`channel:${d.channelId}`);
        }),
        onCustomEvent<AppEventMap["guild:channel:deleted"]>("guild:channel:deleted", (d) => {
            invalidate(`guild:${d.guildId}:channels`);
            invalidate(`channel:${d.channelId}`);
        }),
        onCustomEvent<AppEventMap["guild:member:added"]>("guild:member:added", (d) => {
            invalidate(`guild:${d.guildId}:members`);
        }),
        onCustomEvent<AppEventMap["guild:member:removed"]>("guild:member:removed", (d) => {
            invalidate(`guild:${d.guildId}:members`);
        }),

        // DM changes
        onCustomEvent<AppEventMap["dm:channel:created"]>("dm:channel:created", () => {
            invalidate("dms");
        }),
        onCustomEvent<AppEventMap["dm:channel:deleted"]>("dm:channel:deleted", (d) => {
            invalidate("dms");
            invalidate(`dm:${d.channelId}`);
        }),
        onCustomEvent<AppEventMap["dm:member:added"]>("dm:member:added", (d) => {
            invalidate("dms");
            invalidate(`dm:${d.channelId}`);
        }),
        onCustomEvent<AppEventMap["dm:member:left"]>("dm:member:left", (d) => {
            invalidate("dms");
            invalidate(`dm:${d.channelId}`);
        }),

        // Friend changes
        onEvent("friend:request:accepted", () => invalidate("friends")),
        onEvent("friend:removed", () => invalidate("friends")),

        // Presence — short TTL already, but clear on explicit updates
        onCustomEvent<AppEventMap["dm:user:presence"]>("dm:user:presence", () => {
            invalidate("presence:*");
        }),

        // Reconnect — everything could be stale
        onEvent("realtime:reconnected", () => {
            invalidate("guilds");
            invalidate("dms");
            invalidate("friends");
            invalidate("presence:*");
        }),
    ];

    return () => cleanups.forEach(fn => fn());
}
