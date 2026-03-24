import { useCallback } from "react";
import { roles } from "../api/client";
import type { GuildRole } from "../types/guild";

export type { GuildRole };

export function useGuildRoles() {
    const getRoles = useCallback(
        (guildId: string): Promise<GuildRole[]> => roles.list(guildId),
        [],
    );

    const createRole = useCallback(async (guildId: string, name?: string): Promise<GuildRole | null> => {
        try {
            return await roles.create(guildId, name ?? "New Role");
        } catch {
            return null;
        }
    }, []);

    const updateRole = useCallback(async (guildId: string, roleId: string, data: { name?: string; position?: number }): Promise<boolean> => {
        try {
            await roles.update(guildId, roleId, data);
            return true;
        } catch {
            return false;
        }
    }, []);

    const deleteRole = useCallback(async (guildId: string, roleId: string): Promise<boolean> => {
        try {
            await roles.delete(guildId, roleId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const setPermission = useCallback(async (guildId: string, roleId: string, permissionId: string, allow: boolean): Promise<boolean> => {
        try {
            await roles.setPermission(guildId, roleId, permissionId, allow);
            return true;
        } catch {
            return false;
        }
    }, []);

    const assignRole = useCallback(async (guildId: string, roleId: string, userId: string): Promise<boolean> => {
        try {
            await roles.assign(guildId, roleId, userId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const removeRole = useCallback(async (guildId: string, roleId: string, userId: string): Promise<boolean> => {
        try {
            await roles.unassign(guildId, roleId, userId);
            return true;
        } catch {
            return false;
        }
    }, []);

    return { getRoles, createRole, updateRole, deleteRole, setPermission, assignRole, removeRole };
}
