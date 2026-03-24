export interface Friend {
    id: string;
    status: number;
    otherUserId: string;
    otherUsername: string;
    otherDisplayName: string;
    otherAvatarUrl: string | null;
}

export interface FriendRequests {
    incoming: Friend[];
    outgoing: Friend[];
}
