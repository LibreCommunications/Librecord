import { useCallback } from "react";
import { reactions } from "../api/client";

export function useReactions() {
    const addReaction = useCallback(async (messageId: string, emoji: string): Promise<boolean> => {
        try {
            await reactions.add(messageId, emoji);
            return true;
        } catch {
            return false;
        }
    }, []);

    const removeReaction = useCallback(async (messageId: string, emoji: string): Promise<boolean> => {
        try {
            await reactions.remove(messageId, emoji);
            return true;
        } catch {
            return false;
        }
    }, []);

    return { addReaction, removeReaction };
}
