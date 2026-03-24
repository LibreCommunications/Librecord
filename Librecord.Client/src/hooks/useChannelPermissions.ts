import { useCallback } from "react";
import { channelPermissions, type ChannelOverride } from "../api/client";

export type { ChannelOverride };

export function useChannelPermissions() {
    const getOverrides = useCallback(
        (channelId: string): Promise<ChannelOverride[]> => channelPermissions.getOverrides(channelId),
        [],
    );

    const setOverride = useCallback(
        async (
            channelId: string,
            opts: {
                roleId?: string | null;
                userId?: string | null;
                permissionId: string;
                allow: boolean | null;
            },
        ): Promise<boolean> => {
            try {
                await channelPermissions.setOverride(channelId, opts);
                return true;
            } catch {
                return false;
            }
        },
        [],
    );

    return { getOverrides, setOverride };
}
