import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface GuildMember {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    joinedAt: string;
    roles: { id: string; name: string }[];
}

export function useGuildMembers() {
    const auth = useAuth();

    async function getMembers(guildId: string): Promise<GuildMember[]> {
        const res = await fetchWithAuth(
            `${API_URL}/guilds/${guildId}/members`,
            {},
            auth
        );

        if (!res.ok) return [];
        return res.json();
    }

    return { getMembers };
}
