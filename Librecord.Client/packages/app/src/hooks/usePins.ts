import { useCallback } from "react";
import { pins } from "@librecord/api-client";
import type { PinnedMessage } from "@librecord/domain";

export type { PinnedMessage };

export function usePins() {
    const pinMessage = useCallback(async (channelId: string, messageId: string): Promise<boolean> => {
        try {
            await pins.pin(channelId, messageId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const unpinMessage = useCallback(async (channelId: string, messageId: string): Promise<boolean> => {
        try {
            await pins.unpin(channelId, messageId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const getPins = useCallback(
        (channelId: string): Promise<PinnedMessage[]> => pins.list(channelId),
        [],
    );

    return { pinMessage, unpinMessage, getPins };
}
