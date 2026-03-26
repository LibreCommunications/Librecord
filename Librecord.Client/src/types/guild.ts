export interface GuildSummary {
    id: string;
    name: string;
    iconUrl: string | null;
}

export interface Guild {
    id: string;
    name: string;
    iconUrl: string | null;
    createdAt?: string;
}

export interface GuildChannel {
    id: string;
    name: string;
    type: number;
    topic?: string | null | undefined;
    position?: number;
    parentId?: string | null;
}

export interface GuildMember {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    joinedAt: string;
    roles: { id: string; name: string }[];
}

export interface GuildPermissions {
    isOwner: boolean;
    manageGuild: boolean;
    manageChannels: boolean;
    manageRoles: boolean;
    kickMembers: boolean;
    banMembers: boolean;
    inviteMembers: boolean;
}

export interface GuildRole {
    id: string;
    name: string;
    position: number;
    guildId: string;
    permissions?: RolePermission[];
    members?: { userId: string }[];
}

export interface RolePermission {
    roleId: string;
    permissionId: string;
    allow: boolean;
    permission?: { id: string; name: string; type: string };
}

export interface GuildInvite {
    id: string;
    code: string;
    guildId: string;
    creator: { id: string; username: string; displayName: string };
    maxUses: number | null;
    usesCount: number;
    expiresAt: string | null;
    createdAt: string;
}
