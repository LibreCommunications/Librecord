import type { GuildEventMap } from "./guildEvents";

export function dispatchGuildEvent<K extends keyof GuildEventMap>(
    type: K,
    detail: GuildEventMap[K]
) {
    window.dispatchEvent(
        new CustomEvent(type, { detail })
    );
}
