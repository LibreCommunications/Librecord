import { useAuth } from "../context/AuthContext";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export function useGuildSettings() {
    const auth = useAuth();

    async function updateGuild(guildId: string, data: { name?: string }): Promise<boolean> {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }, auth);
        return res.ok;
    }

    async function deleteGuild(guildId: string): Promise<boolean> {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}`, { method: "DELETE" }, auth);
        return res.ok;
    }

    async function kickMember(guildId: string, userId: string): Promise<boolean> {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/kick/${userId}`, { method: "POST" }, auth);
        return res.ok;
    }

    async function banMember(guildId: string, userId: string, reason?: string): Promise<boolean> {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/bans/${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
        }, auth);
        return res.ok;
    }

    async function unbanMember(guildId: string, userId: string): Promise<boolean> {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/bans/${userId}`, { method: "DELETE" }, auth);
        return res.ok;
    }

    async function getBans(guildId: string): Promise<any[]> {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/bans`, {}, auth);
        if (!res.ok) return [];
        return res.json();
    }

    return { updateGuild, deleteGuild, kickMember, banMember, unbanMember, getBans };
}
