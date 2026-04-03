export interface DmUser {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
}

export interface DmChannel {
    id: string;
    name?: string | null;
    isGroup: boolean;
    isFriend?: boolean | null;
    members: DmUser[];
}
