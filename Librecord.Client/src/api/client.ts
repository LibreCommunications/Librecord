import { fetchWithAuth } from "./fetchWithAuth";

export const API_URL: string = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
    status: number;
    statusText: string;
    url: string;

    constructor(status: number, statusText: string, url: string) {
        super(`API ${status} ${statusText}: ${url}`);
        this.name = "ApiError";
        this.status = status;
        this.statusText = statusText;
        this.url = url;
    }
}

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const res = await fetchWithAuth(`${API_URL}${path}`, options);

    if (!res.ok) {
        throw new ApiError(res.status, res.statusText, path);
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

function json(body: unknown): RequestInit {
    return {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

export const auth = {
    me: () => request<{
        userId: string;
        username: string;
        displayName: string;
        email: string;
        avatarUrl?: string | null;
        guilds?: { guildId: string; name: string; iconUrl: string | null }[];
    }>("/users/me"),
};

import type { GuildSummary, Guild, GuildChannel, GuildMember, GuildPermissions } from "../types/guild";

export const guilds = {
    list: () => request<GuildSummary[]>("/guilds").catch(() => [] as GuildSummary[]),
    get: (id: string) => requestOptional<Guild>(`/guilds/${id}`),
    create: (name: string) => request<Guild>("/guilds", { method: "POST", ...json({ name }) }),
    update: (id: string, data: { name: string }) => request<Guild>(`/guilds/${id}`, { method: "PUT", ...json(data) }),
    delete: (id: string) => request<void>(`/guilds/${id}`, { method: "DELETE" }),

    channels: (guildId: string) => request<GuildChannel[]>(`/guilds/${guildId}/channels`).catch(() => [] as GuildChannel[]),
    getChannel: (channelId: string) => requestOptional<GuildChannel & { topic?: string }>(`/channels/${channelId}`),
    members: (guildId: string) => request<GuildMember[]>(`/guilds/${guildId}/members`).catch(() => [] as GuildMember[]),
    myPermissions: (guildId: string) => requestOptional<GuildPermissions>(`/guilds/${guildId}/permissions/me`),
};

export const channels = {
    create: (guildId: string, data: { name: string; type: number; position: number }) =>
        request<GuildChannel>(`/channels/guild/${guildId}`, { method: "POST", ...json(data) }),
    update: (channelId: string, data: { name?: string; topic?: string | null }) =>
        request<GuildChannel>(`/channels/${channelId}`, { method: "PUT", ...json(data) }),
    delete: (channelId: string) =>
        request<void>(`/channels/${channelId}`, { method: "DELETE" }),
};

import type { Message } from "../types/message";

export const guildMessages = {
    list: (channelId: string, limit = 50, before?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) params.set("before", before);
        return request<Message[]>(`/guild-channels/${channelId}/messages?${params}`).catch(() => [] as Message[]);
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

import type { DmChannel } from "../types/dm";

export const dms = {
    list: () => request<DmChannel[]>("/dms").catch(() => [] as DmChannel[]),
    get: (channelId: string) => requestOptional<DmChannel>(`/dms/${channelId}`),
    start: (targetUserId: string) =>
        request<{ channelId: string }>(`/dms/start/${targetUserId}`, { method: "POST", ...json({ content: "" }) }),
    createGroup: (name: string, memberIds: string[]) =>
        request<{ channelId: string; isGroup: boolean }>("/dms/group", { method: "POST", ...json({ name, memberIds }) }),
    addParticipant: (channelId: string, userId: string) =>
        request<void>(`/dms/${channelId}/participants/${userId}`, { method: "POST" }),
    leave: (channelId: string) =>
        request<void>(`/dms/${channelId}/leave`, { method: "DELETE" }),
    delete: (channelId: string) =>
        request<void>(`/dms/${channelId}`, { method: "DELETE" }),
};

import type { TransportMessage } from "../types/message";

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
        } catch {
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

import type { Friend, FriendRequests } from "../types/friend";

export const friends = {
    list: () => request<Friend[]>("/friends/list").catch(() => [] as Friend[]),
    requests: () => requestOptional<FriendRequests>("/friends/requests"),
    sendRequest: (username: string) =>
        request<{ success: boolean }>("/friends/request", { method: "POST", ...json({ username }) }),
    accept: (requesterId: string) =>
        request<{ success: boolean }>(`/friends/accept/${requesterId}`, { method: "POST" }),
    decline: (requesterId: string) =>
        request<{ success: boolean }>(`/friends/decline/${requesterId}`, { method: "POST" }),
    cancel: (targetId: string) =>
        request<{ success: boolean }>(`/friends/cancel/${targetId}`, { method: "POST" }),
    remove: (friendId: string) =>
        request<{ success: boolean }>(`/friends/remove/${friendId}`, { method: "DELETE" }),
    suggest: (query: string) =>
        request<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>(
            `/friends/suggest?query=${encodeURIComponent(query)}`
        ).catch(() => []),
};

import type { PinnedMessage } from "../types/pin";

export const pins = {
    list: (channelId: string) =>
        request<PinnedMessage[]>(`/channels/${channelId}/pins`).catch(() => [] as PinnedMessage[]),
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
            .catch(() => ({} as Record<string, number>)),
};

export const presence = {
    me: () => requestOptional<{ status: string }>("/presence/me"),
    set: (status: string) =>
        request<{ status: string }>("/presence", { method: "PUT", ...json({ status }) }),
    bulk: (userIds: string[]) =>
        request<Record<string, string>>("/presence/bulk", { method: "POST", ...json({ userIds }) })
            .catch(() => ({} as Record<string, string>)),
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
        ).catch(() => []);
    },
};

export const blocks = {
    list: () => request<{ userId: string; username: string; displayName: string; blockedAt: string }[]>("/blocks").catch(() => []),
    block: (userId: string) => request<void>(`/blocks/${userId}`, { method: "PUT" }),
    unblock: (userId: string) => request<void>(`/blocks/${userId}`, { method: "DELETE" }),
    isBlocked: (userId: string) =>
        request<{ blocked: boolean }>(`/blocks/${userId}`).then(d => d.blocked).catch(() => false),
};

import type { GuildRole } from "../types/guild";

export const roles = {
    list: (guildId: string) => request<GuildRole[]>(`/guilds/${guildId}/roles`).catch(() => [] as GuildRole[]),
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

import type { GuildInvite } from "../types/guild";

export const invites = {
    create: (guildId: string, opts?: { maxUses?: number; expiresInHours?: number }) =>
        request<GuildInvite>(`/guilds/${guildId}/invites`, { method: "POST", ...json(opts ?? {}) }),
    list: (guildId: string) => request<GuildInvite[]>(`/guilds/${guildId}/invites`).catch(() => [] as GuildInvite[]),
    getByCode: (code: string) => requestOptional<{ code: string; guild: { id: string; name: string; iconUrl: string | null } }>(`/invites/${code}`),
    join: (code: string) => request<{ id: string; name: string; iconUrl: string | null }>(`/invites/${code}/join`, { method: "POST" }),
    revoke: (inviteId: string) => request<void>(`/invites/${inviteId}`, { method: "DELETE" }),
};

export interface GuildBanEntry {
    guildId: string;
    userId: string;
    moderatorId: string;
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
        request<GuildBanEntry[]>(`/guilds/${guildId}/bans`).catch(() => [] as GuildBanEntry[]),
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
        request<ChannelOverride[]>(`/channels/${channelId}/permissions`).catch(() => [] as ChannelOverride[]),
    setOverride: (channelId: string, opts: { roleId?: string | null; userId?: string | null; permissionId: string; allow: boolean | null }) =>
        request<void>(`/channels/${channelId}/permissions`, { method: "PUT", ...json(opts) }),
};

import type { Thread, ThreadMessage } from "../types/thread";

export const threads = {
    create: (channelId: string, parentMessageId: string, name: string) =>
        requestOptional<Thread>(`/channels/${channelId}/threads`, { method: "POST", ...json({ parentMessageId, name }) }),
    list: (channelId: string) =>
        request<Thread[]>(`/channels/${channelId}/threads`).catch(() => [] as Thread[]),
    messages: (channelId: string, threadId: string, limit = 50, before?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) params.set("before", before);
        return request<ThreadMessage[]>(`/channels/${channelId}/threads/${threadId}/messages?${params}`).catch(() => [] as ThreadMessage[]);
    },
    postMessage: (channelId: string, threadId: string, content: string) =>
        requestOptional<ThreadMessage>(`/channels/${channelId}/threads/${threadId}/messages`, { method: "POST", ...json({ content }) }),
};

export const voice = {
    participants: (channelId: string) =>
        request<{ userId: string; username: string; displayName: string; avatarUrl: string | null; isMuted: boolean; isDeafened: boolean; isCameraOn: boolean; isScreenSharing: boolean; joinedAt: string }[]>(
            `/voice/channels/${channelId}/participants`
        ).catch(() => []),
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

export type { GuildSummary, Guild, GuildChannel, GuildMember, GuildPermissions, GuildRole, RolePermission, GuildInvite } from "../types/guild";
export type { DmChannel, DmUser } from "../types/dm";
export type { Message, MessageAttachment, MessageReaction, MessageEdit, TransportMessage } from "../types/message";
export type { Friend, FriendRequests } from "../types/friend";
export type { PinnedMessage } from "../types/pin";
export type { Thread, ThreadMessage } from "../types/thread";
