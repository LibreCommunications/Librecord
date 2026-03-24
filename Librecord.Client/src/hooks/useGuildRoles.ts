import { useCallback } from "react";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface GuildRole {
    id: string;
    name: string;
    position: number;
    permissions: { permissionId: string; allow: boolean }[];
}

export function useGuildRoles() {

    const getRoles = useCallback(async (guildId: string): Promise<GuildRole[]> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles`, {});
        if (!res.ok) return [];
        return res.json();
    }, []);

    const createRole = useCallback(async (guildId: string, name?: string): Promise<GuildRole | null> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        if (!res.ok) return null;
        return res.json();
    }, []);

    const updateRole = useCallback(async (guildId: string, roleId: string, data: { name?: string; position?: number }): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles/${roleId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return res.ok;
    }, []);

    const deleteRole = useCallback(async (guildId: string, roleId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles/${roleId}`, { method: "DELETE" });
        return res.ok;
    }, []);

    const setPermission = useCallback(async (guildId: string, roleId: string, permissionId: string, allow: boolean): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles/${roleId}/permissions/${permissionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ allow }),
        });
        return res.ok;
    }, []);

    const assignRole = useCallback(async (guildId: string, roleId: string, userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles/${roleId}/members/${userId}`, { method: "POST" });
        return res.ok;
    }, []);

    const removeRole = useCallback(async (guildId: string, roleId: string, userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles/${roleId}/members/${userId}`, { method: "DELETE" });
        return res.ok;
    }, []);

    return { getRoles, createRole, updateRole, deleteRole, setPermission, assignRole, removeRole };
}
