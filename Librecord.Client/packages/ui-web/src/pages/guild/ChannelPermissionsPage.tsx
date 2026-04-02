import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BackArrowIcon } from "../../components/ui/Icons";
import { useChannels } from "@librecord/app";
import { useGuildRoles } from "@librecord/app";
import { useChannelPermissions } from "@librecord/app";
import type { GuildRole } from "@librecord/domain";
import type { ChannelOverride } from "@librecord/api-client";
import { useGuildPermissions } from "@librecord/app";

const CHANNEL_PERMISSIONS = [
    { id: "22222222-2222-2222-2222-222222222201", name: "View Channel" },
    { id: "22222222-2222-2222-2222-222222222202", name: "Read Messages" },
    { id: "22222222-2222-2222-2222-222222222203", name: "Send Messages" },
    { id: "22222222-2222-2222-2222-222222222204", name: "Send Attachments" },
    { id: "22222222-2222-2222-2222-222222222205", name: "Add Reactions" },
    { id: "22222222-2222-2222-2222-222222222206", name: "Manage Messages" },
];

type TriState = true | false | null;

export default function ChannelPermissionsPage() {
    const { guildId, channelId } = useParams<{ guildId: string; channelId: string }>();
    const navigate = useNavigate();
    const { getChannel } = useChannels();
    const { getRoles } = useGuildRoles();
    const { getOverrides, setOverride } = useChannelPermissions();
    const { permissions, loaded: permsLoaded } = useGuildPermissions(guildId);

    const [channelName, setChannelName] = useState("");
    const [roles, setRoles] = useState<GuildRole[]>([]);
    const [overrides, setOverrides] = useState<ChannelOverride[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [loadedChannelId, setLoadedChannelId] = useState<string | null>(null);
    const loading = loadedChannelId !== channelId;

    useEffect(() => {
        if (!channelId || !guildId) return;
        let cancelled = false;

        Promise.all([
            getChannel(channelId),
            getRoles(guildId),
            getOverrides(channelId),
        ]).then(([channel, roleList, overrideList]) => {
            if (cancelled) return;
            setChannelName(channel?.name ?? "");
            setRoles(roleList);
            setOverrides(overrideList);
            if (roleList.length > 0 && !selectedRoleId) {
                setSelectedRoleId(roleList[0].id);
            }
            setLoadedChannelId(channelId);
        });
        return () => { cancelled = true; };
    }, [channelId, guildId, getChannel, getOverrides, getRoles, selectedRoleId]);

    function getOverrideState(roleId: string, permId: string): TriState {
        const o = overrides.find(
            ov => ov.roleId === roleId && ov.permissionId === permId
        );
        return o?.allow ?? null;
    }

    async function cycleOverride(roleId: string, permId: string) {
        if (!channelId) return;
        const current = getOverrideState(roleId, permId);

        const next: TriState = current === null ? true : current === true ? false : null;

        await setOverride(channelId, {
            roleId,
            permissionId: permId,
            allow: next,
        });

        setOverrides(prev => {
            const filtered = prev.filter(
                o => !(o.roleId === roleId && o.permissionId === permId)
            );
            if (next !== null) {
                filtered.push({
                    id: "",
                    channelId: channelId!,
                    roleId,
                    userId: null,
                    permissionId: permId,
                    allow: next,
                });
            }
            return filtered;
        });
    }

    if (!channelId || !guildId) return null;

    if (permsLoaded && !permissions.manageChannels) {
        navigate(`/app/guild/${guildId}/${channelId}`, { replace: true });
        return null;
    }

    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-y-auto">
            <div className="max-w-3xl mx-auto w-full p-8">
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => navigate(`/app/guild/${guildId}/${channelId}`)}
                        className="text-gray-400 hover:text-white"
                    >
                        <BackArrowIcon size={20} />
                    </button>
                    <h1 className="text-xl font-bold text-white">
                        # {channelName} — Permissions
                    </h1>
                </div>

                {loading ? (
                    <div className="text-gray-400">Loading...</div>
                ) : (
                    <div className="flex gap-6">
                        <div className="w-48 shrink-0 space-y-1">
                            <h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Roles</h3>
                            {roles.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => setSelectedRoleId(r.id)}
                                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                                        selectedRoleId === r.id
                                            ? "bg-white/10 text-white"
                                            : "text-gray-400 hover:bg-white/5"
                                    }`}
                                >
                                    {r.name}
                                </button>
                            ))}
                        </div>

                        {selectedRoleId && (
                            <div className="flex-1">
                                {roles.find(r => r.id === selectedRoleId)?.name === "Owner" ? (
                                    <p className="text-sm text-gray-400">
                                        The Owner role has all permissions and cannot be overridden.
                                    </p>
                                ) : (
                                    <>
                                        <h3 className="text-xs text-gray-400 uppercase font-bold mb-3">
                                            Channel Permission Overrides
                                        </h3>
                                        <p className="text-xs text-gray-500 mb-4">
                                            Click to cycle: Inherit → Allow → Deny
                                        </p>

                                        <div className="space-y-1">
                                            {CHANNEL_PERMISSIONS.map(p => {
                                                const state = getOverrideState(selectedRoleId, p.id);

                                                return (
                                                    <div
                                                        key={p.id}
                                                        className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/5"
                                                    >
                                                        <span className="text-sm text-gray-300">{p.name}</span>
                                                        <button
                                                            onClick={() => cycleOverride(selectedRoleId, p.id)}
                                                            className={`
                                                                px-3 py-1 rounded text-xs font-medium min-w-[72px] text-center
                                                                ${state === true
                                                                    ? "bg-green-600/20 text-green-400 border border-green-600/40"
                                                                    : state === false
                                                                        ? "bg-[#da373c]/20 text-[#f23f43] border border-[#da373c]/40"
                                                                        : "bg-[#2b2d31] text-gray-400 border border-gray-600/30"
                                                                }
                                                            `}
                                                        >
                                                            {state === true ? "Allow" : state === false ? "Deny" : "Inherit"}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
