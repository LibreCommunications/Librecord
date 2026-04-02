import { useCallback } from "react";
import { friends } from "@librecord/api-client";
import type { Friend, FriendRequests } from "@librecord/domain";

export type FriendshipListDto = Friend;
export type FriendSuggestion = { id: string; username: string; displayName: string; avatarUrl: string | null };

export function useFriends() {
    const getFriends = useCallback((): Promise<Friend[]> => friends.list(), []);

    const getRequests = useCallback(async (): Promise<FriendRequests> => {
        const result = await friends.requests();
        return result ?? { incoming: [], outgoing: [] };
    }, []);

    const suggestUsernames = useCallback(async (query: string): Promise<FriendSuggestion[]> => {
        if (!query.trim()) return [];
        return friends.suggest(query);
    }, []);

    const sendRequest = useCallback(async (username: string): Promise<boolean> => {
        try {
            await friends.sendRequest(username);
            return true;
        } catch {
            return false;
        }
    }, []);

    const acceptRequest = useCallback(async (requesterId: string): Promise<boolean> => {
        try {
            await friends.accept(requesterId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const declineRequest = useCallback(async (requesterId: string): Promise<boolean> => {
        try {
            await friends.decline(requesterId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const removeFriend = useCallback(async (friendId: string): Promise<boolean> => {
        try {
            await friends.remove(friendId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const cancelRequest = useCallback(async (targetId: string): Promise<boolean> => {
        try {
            await friends.cancel(targetId);
            return true;
        } catch {
            return false;
        }
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
