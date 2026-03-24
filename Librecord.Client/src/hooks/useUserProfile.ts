import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;
const DEFAULT_AVATAR = "/default-avatar.png";

export function useUserProfile() {
    const { user, loadUser } = useAuth();

    // ---------------------------
    // Resolve avatar URL
    // ---------------------------
    const getAvatarUrl = useCallback((avatarUrl?: string | null): string => {
        if (!avatarUrl) return DEFAULT_AVATAR;
        return `${API_URL}${avatarUrl}`;
    }, []);

    // ---------------------------
    // Update display name
    // ---------------------------
    const updateDisplayName = useCallback(async (newName: string): Promise<boolean> => {
        const res = await fetchWithAuth(
            `${API_URL}/users/display-name`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName: newName }),
            },
        );

        if (!res.ok) return false;

        await loadUser();
        return true;
    }, [loadUser]);

    // ---------------------------
    // Upload avatar
    // ---------------------------
    const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
        const form = new FormData();
        form.append("file", file);

        const res = await fetchWithAuth(
            `${API_URL}/users/avatar`,
            {
                method: "POST",
                body: form,
            },
        );

        if (!res.ok) return null;

        const data = await res.json();

        // Reload user so new avatarUrl is picked up
        await loadUser();

        return data.avatarUrl;
    }, [loadUser]);

    return {
        user,
        getAvatarUrl,
        updateDisplayName,
        uploadAvatar,
    };
}
