import { useCallback } from "react";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface BlockedUser {
    userId: string;
    username: string;
    displayName: string;
    blockedAt: string;
}

export function useBlocks() {
    const blockUser = useCallback(async (userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/blocks/${userId}`, { method: "PUT" });
        return res.ok;
    }, []);

    const unblockUser = useCallback(async (userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/blocks/${userId}`, { method: "DELETE" });
        return res.ok;
    }, []);

    const getBlockedUsers = useCallback(async (): Promise<BlockedUser[]> => {
        const res = await fetchWithAuth(`${API_URL}/blocks`, {});
        if (!res.ok) return [];
        return res.json();
    }, []);

    const isBlocked = useCallback(async (userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/blocks/${userId}`, {});
        if (!res.ok) return false;
        const data = await res.json();
        return data.blocked;
    }, []);

    return { blockUser, unblockUser, getBlockedUsers, isBlocked };
}
