import { useCallback } from "react";
import { dms } from "../api/client";
import type { DmChannel, DmUser } from "../types/dm";

export type { DmChannel, DmUser };

export function useDirectMessagesChannel() {
    const getMyDms = useCallback((): Promise<DmChannel[]> => dms.list(), []);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const startDm = useCallback(async (targetUserId: string, _content: string): Promise<string | null> => {
        try {
            const data = await dms.start(targetUserId);

            window.dispatchEvent(
                new CustomEvent("dm:channel:created", { detail: { channelId: data.channelId } }),
            );

            return data.channelId;
        } catch {
            return null;
        }
    }, []);

    const getDmChannel = useCallback(
        (channelId: string): Promise<DmChannel | null> => dms.get(channelId),
        [],
    );

    const addParticipant = useCallback(async (channelId: string, userId: string): Promise<boolean> => {
        try {
            await dms.addParticipant(channelId, userId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const leaveChannel = useCallback(async (channelId: string): Promise<boolean> => {
        try {
            await dms.leave(channelId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const deleteDm = useCallback(async (channelId: string): Promise<boolean> => {
        try {
            await dms.delete(channelId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const createGroup = useCallback(async (memberIds: string[], name: string): Promise<string | null> => {
        try {
            const data = await dms.createGroup(name, memberIds);

            window.dispatchEvent(
                new CustomEvent("dm:channel:created", { detail: { channelId: data.channelId } }),
            );

            return data.channelId;
        } catch {
            return null;
        }
    }, []);

    return {
        getMyDms,
        startDm,
        getDmChannel,
        addParticipant,
        leaveChannel,
        deleteDm,
        createGroup,
    };
}
