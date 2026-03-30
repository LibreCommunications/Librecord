import { useMemo, useState } from "react";
import { STORAGE } from "../lib/storageKeys";

export interface GuildFolder {
    id: string;
    name?: string;
    color?: string;
    guildIds: string[];
}

export function useGuildFolders() {
    const [folders, setFolders] = useState<GuildFolder[]>(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE.guildFolders) ?? "[]"); } catch { return []; }
    });
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
        try { return new Set(JSON.parse(localStorage.getItem(STORAGE.expandedFolders) ?? "[]")); } catch { return new Set(); }
    });
    const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
    const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [renameColor, setRenameColor] = useState("");

    function toggleExpandFolder(folderId: string) {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
            localStorage.setItem(STORAGE.expandedFolders, JSON.stringify([...next]));
            return next;
        });
    }

    function saveFolders(next: GuildFolder[]) {
        setFolders(next);
        localStorage.setItem(STORAGE.guildFolders, JSON.stringify(next));
    }

    const folderedGuildIds = useMemo(() => new Set(folders.flatMap(f => f.guildIds)), [folders]);

    function createFolder(guildA: string, guildB: string) {
        const folder: GuildFolder = { id: crypto.randomUUID(), guildIds: [guildA, guildB] };
        saveFolders([...folders, folder]);
        toggleExpandFolder(folder.id);
    }

    function updateFolder(folderId: string, name: string, color?: string) {
        saveFolders(folders.map(f => f.id === folderId ? { ...f, name: name.trim() || undefined, color: color || undefined } : f));
    }

    function removeFromFolder(folderId: string, guildId: string) {
        const updated = folders.map(f => f.id === folderId ? { ...f, guildIds: f.guildIds.filter(id => id !== guildId) } : f)
            .filter(f => f.guildIds.length >= 2); // dissolve folders with < 2 guilds
        saveFolders(updated);
    }

    return {
        folders,
        expandedFolders,
        dragOverTarget,
        setDragOverTarget,
        renamingFolder,
        setRenamingFolder,
        renameValue,
        setRenameValue,
        renameColor,
        setRenameColor,
        toggleExpandFolder,
        saveFolders,
        createFolder,
        updateFolder,
        removeFromFolder,
        folderedGuildIds,
    };
}
