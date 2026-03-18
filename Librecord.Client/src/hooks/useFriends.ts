import { useAuth } from "../context/AuthContext";
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
    async function getFriends(): Promise<FriendshipListDto[]> {
        const res = await fetchWithAuth(
            `${API_URL}/friends/list`,
            {},
            auth
        );

        if (!res.ok) return [];
        return await res.json();
    }

    // -----------------------------
    // REQUESTS
    // -----------------------------
    async function getRequests(): Promise<{
        incoming: FriendshipListDto[];
        outgoing: FriendshipListDto[];
    }> {
        const res = await fetchWithAuth(
            `${API_URL}/friends/requests`,
            {},
            auth
        );

        if (!res.ok)
            return { incoming: [], outgoing: [] };

        return await res.json();
    }

    // -----------------------------
    // USERNAME SUGGESTIONS
    // -----------------------------
    async function suggestUsernames(query: string): Promise<FriendSuggestion[]> {
        if (!query.trim()) return [];

        const res = await fetchWithAuth(
            `${API_URL}/friends/suggest?query=${encodeURIComponent(query)}`,
            {},
            auth
        );

        if (!res.ok) return [];
        return await res.json();
    }

    async function sendRequest(username: string) {
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
    }

    async function acceptRequest(requesterId: string) {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/accept/${requesterId}`,
                { method: "POST" },
                auth
            )
        ).ok;
    }

    async function declineRequest(requesterId: string) {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/decline/${requesterId}`,
                { method: "POST" },
                auth
            )
        ).ok;
    }

    async function removeFriend(friendId: string) {
        return (
            await fetchWithAuth(
                `${API_URL}/friends/remove/${friendId}`,
                { method: "DELETE" },
                auth
            )
        ).ok;
    }

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
