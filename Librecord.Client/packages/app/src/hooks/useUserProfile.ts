import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { userProfile, API_URL } from "@librecord/api-client";
const DEFAULT_AVATAR = "/default-avatar.png";

export function useUserProfile() {
    const { user, loadUser } = useAuth();

    const getAvatarUrl = useCallback((avatarUrl?: string | null): string => {
        if (!avatarUrl) return DEFAULT_AVATAR;
        return `${API_URL}${avatarUrl}`;
    }, []);

    const updateDisplayName = useCallback(async (newName: string): Promise<boolean> => {
        try {
            await userProfile.updateDisplayName(newName);
            await loadUser();
            return true;
        } catch {
            return false;
        }
    }, [loadUser]);

    const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
        try {
            const data = await userProfile.updateAvatar(file);
            await loadUser();
            return data.avatarUrl;
        } catch {
            return null;
        }
    }, [loadUser]);

    return {
        user,
        getAvatarUrl,
        updateDisplayName,
        uploadAvatar,
    };
}
