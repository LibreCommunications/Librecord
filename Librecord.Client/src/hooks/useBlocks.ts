import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface BlockedUser {
    userId: string;
    username: string;
    displayName: string;
    blockedAt: string;
}

export function useBlocks() {
    const auth = useAuth();

    async function blockUser(userId: string): Promise<boolean> {
        const res = await fetchWithAuth(`${API_URL}/blocks/${userId}`, { method: "PUT" }, auth);
        return res.ok;
    }

    async function unblockUser(userId: string): Promise<boolean> {
        const res = await fetchWithAuth(`${API_URL}/blocks/${userId}`, { method: "DELETE" }, auth);
        return res.ok;
    }

    async function getBlockedUsers(): Promise<BlockedUser[]> {
        const res = await fetchWithAuth(`${API_URL}/blocks`, {}, auth);
        if (!res.ok) return [];
        return res.json();
    }

    async function isBlocked(userId: string): Promise<boolean> {
        const res = await fetchWithAuth(`${API_URL}/blocks/${userId}`, {}, auth);
        if (!res.ok) return false;
        const data = await res.json();
        return data.blocked;
    }

    return { blockUser, unblockUser, getBlockedUsers, isBlocked };
}
