import { useCallback } from "react";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface FriendshipListDto {
    id: string;
    status: number;
    otherUserId: string;
    otherUsername: string;
    otherDisplayName: string;
    otherAvatarUrl: string | null;
}

export interface FriendSuggestion {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
}

export function useFriends() {

    // -----------------------------
    // FRIEND LIST
    // -----------------------------
    const getFriends = useCallback(async (): Promise<FriendshipListDto[]> => {
        const res = await fetchWithAuth(
            `${API_URL}/friends/list`,
            {},
        );

        if (!res.ok) return [];
        return await res.json();
    }, []);

    // -----------------------------
    // REQUESTS
    // -----------------------------
    const getRequests = useCallback(async (): Promise<{
        incoming: FriendshipListDto[];
        outgoing: FriendshipListDto[];
    }> => {
        const res = await fetchWithAuth(
            `${API_URL}/friends/requests`,
            {},
        );

        if (!res.ok)
            return { incoming: [], outgoing: [] };

        return await res.json();
    }, []);

    // -----------------------------
    // USERNAME SUGGESTIONS
    // -----------------------------
    const suggestUsernames = useCallback(async (query: string): Promise<FriendSuggestion[]> => {
        if (!query.trim()) return [];

        const res = await fetchWithAuth(
            `${API_URL}/friends/suggest?query=${encodeURIComponent(query)}`,
            {},
        );

        if (!res.ok) return [];
        return await res.json();
    }, []);

    const sendRequest = useCallback(async (username: string) => {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/request`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username }),
                },
            )
        ).ok;
    }, []);

    const acceptRequest = useCallback(async (requesterId: string) => {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/accept/${requesterId}`,
                { method: "POST" },
            )
        ).ok;
    }, []);

    const declineRequest = useCallback(async (requesterId: string) => {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/decline/${requesterId}`,
                { method: "POST" },
            )
        ).ok;
    }, []);

    const removeFriend = useCallback(async (friendId: string) => {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/remove/${friendId}`,
                { method: "DELETE" },
            )
        ).ok;
    }, []);

    const cancelRequest = useCallback(async (targetId: string) => {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/cancel/${targetId}`,
                { method: "POST" },
            )
        ).ok;
    }, []);

    return {
        getFriends,
        getRequests,
        sendRequest,
        acceptRequest,
        declineRequest,
        cancelRequest,
        removeFriend,
        suggestUsernames,
    };
}
