import { useEffect, useState } from "react";
import { useGuildRoles, type GuildRole } from "../../hooks/useGuildRoles";

// Known permission IDs (must match backend PermissionIds.cs)
const GUILD_PERMISSIONS = [
    { id: "11111111-1111-1111-1111-111111111101", name: "View Guild" },
    { id: "11111111-1111-1111-1111-111111111102", name: "Manage Guild" },
    { id: "11111111-1111-1111-1111-111111111103", name: "Manage Channels" },
    { id: "11111111-1111-1111-1111-111111111104", name: "Manage Roles" },
    { id: "11111111-1111-1111-1111-111111111105", name: "Invite Members" },
    { id: "11111111-1111-1111-1111-111111111106", name: "Kick Members" },
    { id: "11111111-1111-1111-1111-111111111107", name: "Ban Members" },
];

const CHANNEL_PERMISSIONS = [
    { id: "22222222-2222-2222-2222-222222222201", name: "View Channel" },
    { id: "22222222-2222-2222-2222-222222222202", name: "Read Messages" },
    { id: "22222222-2222-2222-2222-222222222203", name: "Send Messages" },
    { id: "22222222-2222-2222-2222-222222222204", name: "Send Attachments" },
    { id: "22222222-2222-2222-2222-222222222205", name: "Add Reactions" },
    { id: "22222222-2222-2222-2222-222222222206", name: "Manage Messages" },
    { id: "22222222-2222-2222-2222-222222222207", name: "Manage Channels" },
];

interface Props {
    guildId: string;
}

export function GuildRoleSettings({ guildId }: Props) {
    const { getRoles, createRole, updateRole, deleteRole, setPermission } = useGuildRoles();
    const [roles, setRoles] = useState<GuildRole[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    useEffect(() => {
        getRoles(guildId).then(r => {
            setRoles(r);
            if (r.length > 0 && !selectedId) setSelectedId(r[0].id);
        });
    }, [guildId]);

    const selected = roles.find(r => r.id === selectedId);

    useEffect(() => {
        if (selected) setEditName(selected.name);
    }, [selectedId]);

    async function handleCreate() {
        const role = await createRole(guildId, "New Role");
        if (role) {
            setRoles(prev => [...prev, { ...role, permissions: [] }]);
            setSelectedId(role.id);
        }
    }

    async function handleSaveName() {
        if (!selectedId || !editName.trim()) return;
        await updateRole(guildId, selectedId, { name: editName.trim() });
        setRoles(prev => prev.map(r => r.id === selectedId ? { ...r, name: editName.trim() } : r));
    }

    async function handleDelete() {
        if (!selectedId) return;
        if (await deleteRole(guildId, selectedId)) {
            setRoles(prev => prev.filter(r => r.id !== selectedId));
            setSelectedId(roles.find(r => r.id !== selectedId)?.id ?? null);
        }
    }

    function hasPermission(permId: string): boolean {
        return selected?.permissions.some(p => p.permissionId === permId && p.allow) ?? false;
    }

    async function togglePermission(permId: string) {
        if (!selectedId) return;
        const current = hasPermission(permId);
        await setPermission(guildId, selectedId, permId, !current);
        setRoles(prev => prev.map(r => {
            if (r.id !== selectedId) return r;
            const perms = current
                ? r.permissions.filter(p => p.permissionId !== permId)
                : [...r.permissions, { permissionId: permId, allow: true }];
            return { ...r, permissions: perms };
        }));
    }

    return (
        <div className="flex gap-4">
            {/* Role list */}
            <div className="w-48 space-y-1">
                {roles.map(r => (
                    <button
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                            selectedId === r.id ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5"
                        }`}
                    >
                        {r.name}
                    </button>
                ))}
                <button
                    onClick={handleCreate}
                    className="w-full text-left px-3 py-2 rounded text-sm text-[#5865F2] hover:bg-white/5"
                >
                    + Create Role
                </button>
            </div>

            {/* Role editor */}
            {selected && (
                <div className="flex-1 space-y-4">
                    {selected.name !== "@everyone" && selected.name !== "Owner" && (
                        <div>
                            <label className="block text-xs text-gray-400 mb-1 uppercase">Role Name</label>
                            <div className="flex gap-2">
                                <input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded bg-[#1e1f22] text-white text-sm"
                                />
                                <button onClick={handleSaveName} className="px-3 py-2 rounded bg-[#5865F2] text-white text-sm">
                                    Save
                                </button>
                            </div>
                        </div>
                    )}

                    {selected.name === "Owner" ? (
                        <p className="text-sm text-gray-400">
                            The Owner role has all permissions and cannot be modified.
                        </p>
                    ) : (
                        <>
                            <div>
                                <h3 className="text-xs text-gray-400 uppercase mb-2">Guild Permissions</h3>
                                {GUILD_PERMISSIONS.map(p => (
                                    <label key={p.id} className="flex items-center gap-2 py-1 text-sm text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={hasPermission(p.id)}
                                            onChange={() => togglePermission(p.id)}
                                            className="rounded"
                                        />
                                        {p.name}
                                    </label>
                                ))}
                            </div>

                            <div>
                                <h3 className="text-xs text-gray-400 uppercase mb-1">Default Channel Permissions</h3>
                                <p className="text-xs text-gray-500 mb-2">
                                    These apply to all channels unless overridden per-channel.
                                </p>
                                {CHANNEL_PERMISSIONS.map(p => (
                                    <label key={p.id} className="flex items-center gap-2 py-1 text-sm text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={hasPermission(p.id)}
                                            onChange={() => togglePermission(p.id)}
                                            className="rounded"
                                        />
                                        {p.name}
                                    </label>
                                ))}
                            </div>
                        </>
                    )}

                    {selected.name !== "@everyone" && selected.name !== "Owner" && (
                        <button
                            onClick={handleDelete}
                            className="px-3 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                        >
                            Delete Role
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
