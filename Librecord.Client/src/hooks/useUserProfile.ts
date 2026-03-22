import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;
const DEFAULT_AVATAR = "/default-avatar.png";

export function useUserProfile() {
    const auth = useAuth();
    const { user, loadUser } = auth;

    // ---------------------------
    // Resolve avatar URL
    // ---------------------------
    function getAvatarUrl(avatarUrl?: string | null): string {
        if (!avatarUrl) return DEFAULT_AVATAR;
        return `${API_URL}${avatarUrl}`;
    }

    // ---------------------------
    // Update display name
    // ---------------------------
    async function updateDisplayName(newName: string): Promise<boolean> {
        const res = await fetchWithAuth(
            `${API_URL}/users/display-name`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName: newName }),
            },
            auth
        );

        if (!res.ok) return false;

        await loadUser();
        return true;
    }

    // ---------------------------
    // Upload avatar
    // ---------------------------
    async function uploadAvatar(file: File): Promise<string | null> {
        const form = new FormData();
        form.append("file", file);

        const res = await fetchWithAuth(
            `${API_URL}/users/avatar`,
            {
                method: "POST",
                body: form,
            },
            auth
        );

        if (!res.ok) return null;

        const data = await res.json();

        // Reload user so new avatarUrl is picked up
        await loadUser();

        return data.avatarUrl;
    }

    return {
        user,
        getAvatarUrl,
        updateDisplayName,
        uploadAvatar,
    };
}
