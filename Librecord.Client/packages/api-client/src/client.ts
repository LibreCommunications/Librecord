import { fetchWithAuth } from "./fetchWithAuth.ts";
import { logger, cached, invalidate } from "@librecord/domain";

export const API_URL: string =
    (typeof localStorage !== "undefined" && localStorage.getItem("lr:api-url")) ||
    import.meta.env.VITE_API_URL;

export class ApiError extends Error {
    status: number;
    statusText: string;
    url: string;
    body?: string;

    constructor(status: number, statusText: string, url: string, body?: string) {
        super(body || `API ${status} ${statusText}: ${url}`);
        this.name = "ApiError";
        this.status = status;
        this.statusText = statusText;
        this.url = url;
        this.body = body;
    }
}

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const res = await fetchWithAuth(`${API_URL}${path}`, options);

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ApiError(res.status, res.statusText, path, body);
    }

    const text = await res.text();
    if (!text) return undefined as T;

    return JSON.parse(text) as T;
}

async function requestOptional<T>(
    path: string,
    options: RequestInit = {},
): Promise<T | null> {
    try {
        return await request<T>(path, options);
    } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
            return null;
        }
        throw err;
    }
}

/** Log API errors but return a fallback value so callers always get data. */
function fallback<T>(label: string, value: T) {
    return (err: unknown) => {
        logger.api.warn(label, err);
        return value;
    };
}

function json(body: unknown): RequestInit {
    return {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

import type { UserProfile, UserSummary as UserSummaryType } from "@librecord/domain";

export const auth = {
    me: () => request<{
        userId: string;
        username: string;
        displayName: string;
        email: string;
        avatarUrl?: string | null;
        guilds?: { guildId: string; name: string; iconUrl: string | null }[];
    }>("/users/me"),
    logoutAll: () => request<void>("/auth/logout-all", { method: "POST" }),

    // Account recovery
    recoverAccount: (emailOrUsername: string, recoveryCode: string, newPassword: string) =>
        fetch(`${API_URL}/auth/recover-account`, { method: "POST", credentials: "include", ...json({ emailOrUsername, recoveryCode, newPassword }) }),
    regenerateAccountRecoveryCodes: (password: string) =>
        request<{ recoveryCodes: string[] }>("/auth/recovery-codes/regenerate", { method: "POST", ...json({ password }) }),
    getRecoveryCodeCount: () =>
        request<{ count: number }>("/auth/recovery-codes/count"),

    // 2FA login
    verifyTwoFactor: (sessionToken: string, code: string) =>
        fetch(`${API_URL}/auth/2fa/verify`, { method: "POST", credentials: "include", ...json({ sessionToken, code }) }),
    verifyTwoFactorRecovery: (sessionToken: string, recoveryCode: string) =>
        fetch(`${API_URL}/auth/2fa/recovery`, { method: "POST", credentials: "include", ...json({ sessionToken, recoveryCode }) }),

    // 2FA management (authenticated)
    setupTwoFactor: () =>
        request<{ sharedKey: string; authenticatorUri: string }>("/auth/2fa/setup", { method: "POST" }),
    enableTwoFactor: (code: string) =>
        request<{ recoveryCodes: string[] }>("/auth/2fa/enable", { method: "POST", ...json({ code }) }),
    disableTwoFactor: (password: string) =>
        request<{ success: boolean }>("/auth/2fa/disable", { method: "POST", ...json({ password }) }),
    regenerateRecoveryCodes: (password: string) =>
        request<{ recoveryCodes: string[] }>("/auth/2fa/regenerate-recovery-codes", { method: "POST", ...json({ password }) }),
};

export const userProfiles = {
    get: (userId: string) => cached(`user:${userId}`, () => request<UserProfile>(`/users/${userId}`)),
    getFriends: (userId: string) => cached(`user:${userId}:friends`, () => request<UserSummaryType[]>(`/users/${userId}/friends`).catch(fallback("getFriends", [] as UserSummaryType[]))),
    updateBio: (bio: string | null) => { invalidate("user:*"); return request<void>("/users/bio", { method: "PUT", ...json({ bio }) }); },
    uploadBanner: (file: File) => {
        const form = new FormData();
        form.append("file", file);
        return request<{ bannerUrl: string }>("/users/banner", { method: "POST", body: form });
    },
    updateMutualFriendsVisible: (visible: boolean) => request<void>("/users/mutual-friends-visible", { method: "PUT", ...json({ visible }) }),
};

import type { GuildSummary, Guild, GuildChannel, GuildMember, GuildPermissions } from "@librecord/domain";

export const guilds = {
    list: () => cached("guilds", () => request<GuildSummary[]>("/guilds").catch(fallback("guilds.list", [] as GuildSummary[]))),
    get: (id: string) => cached(`guild:${id}`, () => requestOptional<Guild>(`/guilds/${id}`)),
    create: (name: string) => { invalidate("guilds"); return request<Guild>("/guilds", { method: "POST", ...json({ name }) }); },
    update: (id: string, data: { name: string }) => { invalidate("guilds"); invalidate(`guild:${id}`); return request<Guild>(`/guilds/${id}`, { method: "PUT", ...json(data) }); },
    delete: (id: string) => { invalidate("guilds"); invalidate(`guild:${id}*`); return request<void>(`/guilds/${id}`, { method: "DELETE" }); },

    channels: (guildId: string) => cached(`guild:${guildId}:channels`, () => request<GuildChannel[]>(`/guilds/${guildId}/channels`).catch(fallback("guilds.channels", [] as GuildChannel[]))),
    getChannel: (channelId: string) => cached(`channel:${channelId}`, () => requestOptional<GuildChannel & { topic?: string }>(`/channels/${channelId}`)),
    members: (guildId: string) => cached(`guild:${guildId}:members`, () => request<GuildMember[]>(`/guilds/${guildId}/members`).catch(fallback("guilds.members", [] as GuildMember[]))),
    myPermissions: (guildId: string, channelId?: string) =>
        requestOptional<GuildPermissions>(`/guilds/${guildId}/permissions/me${channelId ? `?channelId=${channelId}` : ""}`),
    uploadIcon: (guildId: string, file: File) => {
        const form = new FormData();
        form.append("file", file);
        return request<{ iconUrl: string }>(`/guilds/${guildId}/icon`, { method: "POST", body: form });
    },
};

export const channels = {
    create: (guildId: string, data: { name: string; type: number; position: number; parentId?: string | null }) => {
        invalidate(`guild:${guildId}:channels`);
        return request<GuildChannel>(`/channels/guild/${guildId}`, { method: "POST", ...json(data) });
    },
    update: (channelId: string, data: { name?: string; topic?: string | null; parentId?: string | null }) => {
        invalidate(`channel:${channelId}`);
        return request<GuildChannel>(`/channels/${channelId}`, { method: "PUT", ...json(data) });
    },
    delete: (channelId: string) => {
        invalidate(`channel:${channelId}`);
        return request<void>(`/channels/${channelId}`, { method: "DELETE" });
    },
};

import type { Message } from "@librecord/domain";

export const guildMessages = {
    list: (channelId: string, limit = 50, before?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) params.set("before", before);
        return request<Message[]>(`/guild-channels/${channelId}/messages?${params}`).catch(fallback("guildMessages.list", [] as Message[]));
    },
    get: (channelId: string, messageId: string) =>
        requestOptional<Message>(`/guild-channels/${channelId}/messages/${messageId}`),
    create: (channelId: string, content: string, clientMessageId?: string, replyToMessageId?: string) =>
        request<Message>(`/guild-channels/${channelId}/messages`, { method: "POST", ...json({ content, clientMessageId, replyToMessageId }) }),
    edit: (channelId: string, messageId: string, content: string) =>
        request<Message>(`/guild-channels/${channelId}/messages/${messageId}`, { method: "PUT", ...json({ content }) }),
    delete: (channelId: string, messageId: string) =>
        request<void>(`/guild-channels/${channelId}/messages/${messageId}`, { method: "DELETE" }),
};

import type { DmChannel } from "@librecord/domain";

export const dms = {
    list: () => cached("dms", () => request<DmChannel[]>("/dms").catch(fallback("dms.list", [] as DmChannel[]))),
    get: (channelId: string) => cached(`dm:${channelId}`, () => requestOptional<DmChannel>(`/dms/${channelId}`)),
    start: (targetUserId: string) => { invalidate("dms"); return request<{ channelId: string }>(`/dms/start/${targetUserId}`, { method: "POST", ...json({ content: "" }) }); },
    createGroup: (name: string, memberIds: string[]) => { invalidate("dms"); return request<{ channelId: string; isGroup: boolean }>("/dms/group", { method: "POST", ...json({ name, memberIds }) }); },
    addParticipant: (channelId: string, userId: string) => { invalidate(`dm:${channelId}`); invalidate("dms"); return request<void>(`/dms/${channelId}/participants/${userId}`, { method: "POST" }); },
    leave: (channelId: string) => { invalidate(`dm:${channelId}`); invalidate("dms"); return request<void>(`/dms/${channelId}/leave`, { method: "DELETE" }); },
    delete: (channelId: string) => { invalidate(`dm:${channelId}`); invalidate("dms"); return request<void>(`/dms/${channelId}`, { method: "DELETE" }); },
};

import type { TransportMessage } from "@librecord/domain";

function mapTransport(msg: TransportMessage): Message {
    return {
        id: msg.id,
        channelId: msg.channelId,
        content: msg.content,
        createdAt: msg.createdAt,
        editedAt: msg.editedAt ?? null,
        author: msg.author,
        replyTo: msg.replyTo ?? null,
        attachments: msg.attachments,
        reactions: msg.reactions,
        edits: msg.edits,
    };
}

export const dmMessages = {
    list: async (channelId: string, limit = 50, before?: string): Promise<Message[]> => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) params.set("before", before);
        try {
            const data = await request<TransportMessage[]>(`/dm-messages/channel/${channelId}?${params}`);
            return data.map(mapTransport);
        } catch (err) {
            logger.api.warn("dmMessages.list", err);
            return [];
        }
    },
    send: (channelId: string, content: string, clientMessageId: string, replyToMessageId?: string) =>
        request<void>(`/dm-messages/channel/${channelId}`, { method: "POST", ...json({ content, clientMessageId, replyToMessageId }) }),
    edit: async (messageId: string, content: string): Promise<Message> => {
        const msg = await request<TransportMessage>(`/dm-messages/${messageId}`, { method: "PUT", ...json({ content }) });
        return mapTransport(msg);
    },
    delete: (messageId: string) =>
        request<void>(`/dm-messages/${messageId}`, { method: "DELETE" }),
};

import type { Friend, FriendRequests } from "@librecord/domain";

export const friends = {
    list: () => cached("friends", () => request<Friend[]>("/friends/list").catch(fallback("friends.list", [] as Friend[]))),
    requests: () => requestOptional<FriendRequests>("/friends/requests"),
    sendRequest: (username: string) =>
        request<{ success: boolean }>("/friends/request", { method: "POST", ...json({ username }) }),
    accept: (requesterId: string) => { invalidate("friends"); return request<{ success: boolean }>(`/friends/accept/${requesterId}`, { method: "POST" }); },
    decline: (requesterId: string) => request<{ success: boolean }>(`/friends/decline/${requesterId}`, { method: "POST" }),
    cancel: (targetId: string) => request<{ success: boolean }>(`/friends/cancel/${targetId}`, { method: "POST" }),
    remove: (friendId: string) => { invalidate("friends"); return request<{ success: boolean }>(`/friends/remove/${friendId}`, { method: "DELETE" }); },
    suggest: (query: string) =>
        request<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>(
            `/friends/suggest?query=${encodeURIComponent(query)}`
        ).catch(fallback("friends.suggest", [])),
};

import type { PinnedMessage } from "@librecord/domain";

export const pins = {
    list: (channelId: string) =>
        request<PinnedMessage[]>(`/channels/${channelId}/pins`).catch(fallback("pins.list", [] as PinnedMessage[])),
    pin: (channelId: string, messageId: string) =>
        request<void>(`/channels/${channelId}/pins/${messageId}`, { method: "POST" }),
    unpin: (channelId: string, messageId: string) =>
        request<void>(`/channels/${channelId}/pins/${messageId}`, { method: "DELETE" }),
};

export const reactions = {
    add: (messageId: string, emoji: string) =>
        request<void>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: "PUT" }),
    remove: (messageId: string, emoji: string) =>
        request<void>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: "DELETE" }),
};

export const readState = {
    markAsRead: (channelId: string, messageId: string) =>
        request<void>(`/channels/${channelId}/ack`, { method: "POST", ...json({ messageId }) }),
    getUnreadCounts: (channelIds: string[]) =>
        request<Record<string, number>>("/channels/unread", { method: "POST", ...json({ channelIds }) })
            .catch(fallback("readState.getUnreadCounts", {} as Record<string, number>)),
    getLastRead: (channelId: string) =>
        request<{ messageId: string | null }>(`/channels/${channelId}/last-read`)
            .then(r => r.messageId)
            .catch(() => null),
};

export const presence = {
    me: () => requestOptional<{ status: string }>("/presence/me"),
    set: (status: string) =>
        request<{ status: string }>("/presence", { method: "PUT", ...json({ status }) }),
    bulk: (userIds: string[]) => {
        const key = `presence:${userIds.slice().sort().join(",")}`;
        return cached(key, () =>
            request<Record<string, string>>("/presence/bulk", { method: "POST", ...json({ userIds }) })
                .catch(fallback("presence.bulk", {} as Record<string, string>)),
            15_000, // 15s TTL — presence changes more often
        );
    },
};

export const userProfile = {
    updateDisplayName: (displayName: string) =>
        request<void>("/users/display-name", { method: "POST", ...json({ displayName }) }),
    updateAvatar: (file: File) => {
        const form = new FormData();
        form.append("file", file);
        return request<{ avatarUrl: string }>("/users/avatar", { method: "POST", body: form });
    },
};

export const search = {
    messages: (query: string, opts: { channelId?: string; guildId?: string; limit?: number }) => {
        const params = new URLSearchParams({ q: query });
        if (opts.channelId) params.set("channelId", opts.channelId);
        if (opts.guildId) params.set("guildId", opts.guildId);
        if (opts.limit) params.set("limit", String(opts.limit));
        return request<{ id: string; channelId: string; content: string; createdAt: string; author: { id: string; username: string; displayName: string; avatarUrl: string | null } }[]>(
            `/search?${params}`
        ).catch(fallback("search.messages", []));
    },
};

export const blocks = {
    list: () => request<{ userId: string; username: string; displayName: string; blockedAt: string }[]>("/blocks").catch(fallback("blocks.list", [])),
    block: (userId: string) => request<void>(`/blocks/${userId}`, { method: "PUT" }),
    unblock: (userId: string) => request<void>(`/blocks/${userId}`, { method: "DELETE" }),
    isBlocked: (userId: string) =>
        request<{ blocked: boolean }>(`/blocks/${userId}`).then(d => d.blocked).catch(fallback("blocks.isBlocked", false)),
};

import type { GuildRole } from "@librecord/domain";

export const roles = {
    list: (guildId: string) => request<GuildRole[]>(`/guilds/${guildId}/roles`).catch(fallback("roles.list", [] as GuildRole[])),
    create: (guildId: string, name: string) =>
        request<GuildRole>(`/guilds/${guildId}/roles`, { method: "POST", ...json({ name }) }),
    update: (guildId: string, roleId: string, data: { name?: string; position?: number }) =>
        request<GuildRole>(`/guilds/${guildId}/roles/${roleId}`, { method: "PUT", ...json(data) }),
    delete: (guildId: string, roleId: string) =>
        request<void>(`/guilds/${guildId}/roles/${roleId}`, { method: "DELETE" }),
    setPermission: (guildId: string, roleId: string, permissionId: string, allow: boolean) =>
        request<void>(`/guilds/${guildId}/roles/${roleId}/permissions/${permissionId}`, { method: "PUT", ...json({ allow }) }),
    assign: (guildId: string, roleId: string, userId: string) =>
        request<void>(`/guilds/${guildId}/roles/${roleId}/members/${userId}`, { method: "POST" }),
    unassign: (guildId: string, roleId: string, userId: string) =>
        request<void>(`/guilds/${guildId}/roles/${roleId}/members/${userId}`, { method: "DELETE" }),
};

import type { GuildInvite } from "@librecord/domain";

export const invites = {
    create: (guildId: string, opts?: { maxUses?: number; expiresInHours?: number }) =>
        request<GuildInvite>(`/guilds/${guildId}/invites`, { method: "POST", ...json(opts ?? {}) }),
    list: (guildId: string) => request<GuildInvite[]>(`/guilds/${guildId}/invites`).catch(fallback("invites.list", [] as GuildInvite[])),
    getByCode: (code: string) => requestOptional<{ code: string; guild: { id: string; name: string; iconUrl: string | null } }>(`/invites/${code}`),
    join: (code: string) => request<{ id: string; name: string; iconUrl: string | null }>(`/invites/${code}/join`, { method: "POST" }),
    revoke: (inviteId: string) => request<void>(`/invites/${inviteId}`, { method: "DELETE" }),
};

export interface GuildBanEntry {
    userId: string;
    username: string;
    displayName: string;
    moderator: string;
    reason: string | null;
    createdAt: string;
}

export const guildModeration = {
    leave: (guildId: string) =>
        request<void>(`/guilds/${guildId}/leave`, { method: "POST" }),
    kick: (guildId: string, userId: string) =>
        request<void>(`/guilds/${guildId}/kick/${userId}`, { method: "POST" }),
    ban: (guildId: string, userId: string, reason?: string) =>
        request<void>(`/guilds/${guildId}/bans/${userId}`, { method: "POST", ...json({ reason }) }),
    unban: (guildId: string, userId: string) =>
        request<void>(`/guilds/${guildId}/bans/${userId}`, { method: "DELETE" }),
    getBans: (guildId: string) =>
        request<GuildBanEntry[]>(`/guilds/${guildId}/bans`).catch(fallback("guildModeration.getBans", [] as GuildBanEntry[])),
};

export interface ChannelOverride {
    id: string;
    channelId: string;
    roleId: string | null;
    userId: string | null;
    permissionId: string;
    allow: boolean | null;
}

export const channelPermissions = {
    getOverrides: (channelId: string) =>
        request<ChannelOverride[]>(`/channels/${channelId}/permissions`).catch(fallback("channelPermissions.getOverrides", [] as ChannelOverride[])),
    setOverride: (channelId: string, opts: { roleId?: string | null; userId?: string | null; permissionId: string; allow: boolean | null }) =>
        request<void>(`/channels/${channelId}/permissions`, { method: "PUT", ...json(opts) }),
};

import type { Thread, ThreadMessage } from "@librecord/domain";

export const threads = {
    create: (channelId: string, parentMessageId: string, name: string) =>
        requestOptional<Thread>(`/channels/${channelId}/threads`, { method: "POST", ...json({ parentMessageId, name }) }),
    list: (channelId: string) =>
        request<Thread[]>(`/channels/${channelId}/threads`).catch(fallback("threads.list", [] as Thread[])),
    messages: (channelId: string, threadId: string, limit = 50, before?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) params.set("before", before);
        return request<ThreadMessage[]>(`/channels/${channelId}/threads/${threadId}/messages?${params}`).catch(fallback("threads.messages", [] as ThreadMessage[]));
    },
    postMessage: (channelId: string, threadId: string, content: string) =>
        requestOptional<ThreadMessage>(`/channels/${channelId}/threads/${threadId}/messages`, { method: "POST", ...json({ content }) }),
};

export const voice = {
    participants: (channelId: string) =>
        request<{ userId: string; username: string; displayName: string; avatarUrl: string | null; isMuted: boolean; isDeafened: boolean; isCameraOn: boolean; isScreenSharing: boolean; joinedAt: string }[]>(
            `/voice/channels/${channelId}/participants`
        ).catch(fallback("voice.participants", [])),
};

export const uploads = {
    guildMessage: (channelId: string, content: string, clientMessageId: string, files: File[], signal?: AbortSignal, replyToMessageId?: string) => {
        const form = new FormData();
        form.append("content", content);
        form.append("clientMessageId", clientMessageId);
        if (replyToMessageId) form.append("replyToMessageId", replyToMessageId);
        for (const file of files) form.append("files", file);
        return request<Message>(`/guild-channels/${channelId}/messages/with-attachments`, { method: "POST", body: form, signal });
    },
    dmMessage: (channelId: string, content: string, clientMessageId: string, files: File[], signal?: AbortSignal, replyToMessageId?: string) => {
        const form = new FormData();
        form.append("content", content);
        form.append("clientMessageId", clientMessageId);
        if (replyToMessageId) form.append("replyToMessageId", replyToMessageId);
        for (const file of files) form.append("files", file);
        return request<Message>(`/dm-messages/channel/${channelId}/with-attachments`, { method: "POST", body: form, signal });
    },
};

export type { GuildSummary, Guild, GuildChannel, GuildMember, GuildPermissions, GuildRole, RolePermission, GuildInvite } from "@librecord/domain";
export type { DmChannel, DmUser } from "@librecord/domain";
export type { Message, MessageAttachment, MessageReaction, MessageEdit, TransportMessage } from "@librecord/domain";
export type { Friend, FriendRequests } from "@librecord/domain";
export type { PinnedMessage } from "@librecord/domain";
export type { Thread, ThreadMessage } from "@librecord/domain";
