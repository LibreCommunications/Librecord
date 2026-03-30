export interface UserSummary {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
}

export interface UserProfile {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
    bannerUrl?: string | null;
    createdAt: string;
    isFriend: boolean;
    isSelf: boolean;
    mutualFriendCount?: number;
    friendsVisible?: boolean;
    friendsVisibleSetting?: boolean | null;
}
