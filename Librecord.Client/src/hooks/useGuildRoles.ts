import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface GuildRole {
    id: string;
    name: string;
    position: number;
    permissions: { permissionId: string; allow: boolean }[];
}

export function useGuildRoles() {
    const auth = useAuth();

    const getRoles = useCallback(async (guildId: string): Promise<GuildRole[]> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles`, {}, auth);
        if (!res.ok) return [];
        return res.json();
    }, [auth]);

    const createRole = useCallback(async (guildId: string, name?: string): Promise<GuildRole | null> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        }, auth);
        if (!res.ok) return null;
        return res.json();
    }, [auth]);

    const updateRole = useCallback(async (guildId: string, roleId: string, data: { name?: string; position?: number }): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles/${roleId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }, auth);
        return res.ok;
    }, [auth]);

    const deleteRole = useCallback(async (guildId: string, roleId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles/${roleId}`, { method: "DELETE" }, auth);
        return res.ok;
    }, [auth]);

    const setPermission = useCallback(async (guildId: string, roleId: string, permissionId: string, allow: boolean): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles/${roleId}/permissions/${permissionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ allow }),
        }, auth);
        return res.ok;
    }, [auth]);

    const assignRole = useCallback(async (guildId: string, roleId: string, userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles/${roleId}/members/${userId}`, { method: "POST" }, auth);
        return res.ok;
    }, [auth]);

    const removeRole = useCallback(async (guildId: string, roleId: string, userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/roles/${roleId}/members/${userId}`, { method: "DELETE" }, auth);
        return res.ok;
    }, [auth]);

    return { getRoles, createRole, updateRole, deleteRole, setPermission, assignRole, removeRole };
}
