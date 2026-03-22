import { useCallback } from "react";
import { useAuth } from "./useAuth";
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
    const auth = useAuth();

    // -----------------------------
    // FRIEND LIST
    // -----------------------------
    const getFriends = useCallback(async (): Promise<FriendshipListDto[]> => {
        const res = await fetchWithAuth(
            `${API_URL}/friends/list`,
            {},
            auth
        );

        if (!res.ok) return [];
        return await res.json();
    }, [auth]);

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
            auth
        );

        if (!res.ok)
            return { incoming: [], outgoing: [] };

        return await res.json();
    }, [auth]);

    // -----------------------------
    // USERNAME SUGGESTIONS
    // -----------------------------
    const suggestUsernames = useCallback(async (query: string): Promise<FriendSuggestion[]> => {
        if (!query.trim()) return [];

        const res = await fetchWithAuth(
            `${API_URL}/friends/suggest?query=${encodeURIComponent(query)}`,
            {},
            auth
        );

        if (!res.ok) return [];
        return await res.json();
    }, [auth]);

    const sendRequest = useCallback(async (username: string) => {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/request`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username }),
                },
                auth
            )
        ).ok;
    }, [auth]);

    const acceptRequest = useCallback(async (requesterId: string) => {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/accept/${requesterId}`,
                { method: "POST" },
                auth
            )
        ).ok;
    }, [auth]);

    const declineRequest = useCallback(async (requesterId: string) => {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/decline/${requesterId}`,
                { method: "POST" },
                auth
            )
        ).ok;
    }, [auth]);

    const removeFriend = useCallback(async (friendId: string) => {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/remove/${friendId}`,
                { method: "DELETE" },
                auth
            )
        ).ok;
    }, [auth]);

    return {
        getFriends,
        getRequests,
        sendRequest,
        acceptRequest,
        declineRequest,
        removeFriend,
        suggestUsernames,
    };
}
