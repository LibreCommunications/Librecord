import { useCallback } from "react";
import { blocks } from "@librecord/api-client";
import type { BlockedUser } from "@librecord/domain";

export type { BlockedUser };

export function useBlocks() {
    const blockUser = useCallback(async (userId: string): Promise<boolean> => {
        try {
            await blocks.block(userId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const unblockUser = useCallback(async (userId: string): Promise<boolean> => {
        try {
            await blocks.unblock(userId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const getBlockedUsers = useCallback(
        (): Promise<BlockedUser[]> => blocks.list() as Promise<BlockedUser[]>,
        [],
    );

    const isBlocked = useCallback(
        (userId: string): Promise<boolean> => blocks.isBlocked(userId),
        [],
    );

    return { blockUser, unblockUser, getBlockedUsers, isBlocked };
}
