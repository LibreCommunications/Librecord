import { useCallback } from "react";
import { readState } from "../api/client";

export function useReadState() {
    const markAsRead = useCallback(async (channelId: string, messageId: string): Promise<boolean> => {
        try {
            await readState.markAsRead(channelId, messageId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const getUnreadCounts = useCallback(async (channelIds: string[]): Promise<Record<string, number>> => {
        if (channelIds.length === 0) return {};
        return readState.getUnreadCounts(channelIds);
    }, []);

    return { markAsRead, getUnreadCounts };
}
