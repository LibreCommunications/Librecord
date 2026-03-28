import { useEffect, useState } from "react";
import { useGuildMembers, type GuildMember } from "../../hooks/useGuildMembers";
import { useGuildPermissions } from "../../hooks/useGuildPermissions";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useAuth } from "../../hooks/useAuth";
import { StatusDot } from "../user/StatusDot";
import { MemberContextMenu } from "./MemberContextMenu";
import { presence } from "../../api/client";
import type { AppEventMap } from "../../realtime/events";

interface Props {
    guildId: string;
}

export function MemberSidebar({ guildId }: Props) {
    const { getMembers } = useGuildMembers();
    const { getAvatarUrl } = useUserProfile();
    const { user } = useAuth();
    const { permissions } = useGuildPermissions(guildId);
    const [members, setMembers] = useState<GuildMember[]>([]);
    const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});
    const [ctxMember, setCtxMember] = useState<GuildMember | null>(null);

    useEffect(() => {
        function load() {
            getMembers(guildId).then(async (m) => {
                setMembers(m);
                const userIds = m.map(member => member.userId);
                const map = await presence.bulk(userIds);
                setPresenceMap(map);
            });
        }
        load();

        window.addEventListener("realtime:reconnected", load);
        return () => window.removeEventListener("realtime:reconnected", load);
    }, [guildId, getMembers]);

    useEffect(() => {
        const onPresence = (e: CustomEvent<AppEventMap["guild:user:presence"]>) => {
            setPresenceMap(prev => ({ ...prev, [e.detail.userId]: e.detail.status }));
        };
        const onRemoved = (e: CustomEvent<AppEventMap["guild:member:removed"]>) => {
            if (e.detail.guildId !== guildId) return;
            setMembers(prev => prev.filter(m => m.userId !== e.detail.userId));
        };

        window.addEventListener("guild:user:presence", onPresence as EventListener);
        window.addEventListener("guild:member:removed", onRemoved as EventListener);
        return () => {
            window.removeEventListener("guild:user:presence", onPresence as EventListener);
            window.removeEventListener("guild:member:removed", onRemoved as EventListener);
        };
    }, [guildId]);

    const canModerate = permissions.isOwner || permissions.kickMembers || permissions.banMembers || permissions.manageRoles;

    const grouped = new Map<string, GuildMember[]>();
    for (const member of members) {
        const roleName = member.roles.length > 0 ? member.roles[0].name : "Members";
        if (!grouped.has(roleName)) grouped.set(roleName, []);
        grouped.get(roleName)!.push(member);
    }

    return (
        <div className="w-60 bg-[#2b2d31] border-l border-black/20 flex flex-col overflow-y-auto">
            <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase">
                Members — {members.length}
            </div>

            {[...grouped.entries()].map(([roleName, roleMembers]) => (
                <div key={roleName} className="px-2 mb-2">
                    <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">
                        {roleName} — {roleMembers.length}
                    </div>

                    {roleMembers.map(member => (
                        <div
                            key={member.userId}
                            className="relative flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer"
                            onContextMenu={e => {
                                if (!canModerate || member.userId === user?.userId) return;
                                e.preventDefault();
                                setCtxMember(member);
                            }}
                        >
                            <div className="relative flex-shrink-0">
                                <img
                                    src={getAvatarUrl(member.avatarUrl)}
                                    alt={member.displayName}
                                    className="w-8 h-8 rounded-full object-cover"
                                />
                                <span className="absolute -bottom-0.5 -right-0.5">
                                    <StatusDot status={presenceMap[member.userId] ?? "offline"} />
                                </span>
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm text-gray-200 truncate">
                                    {member.displayName}
                                </div>
                            </div>

                            {ctxMember?.userId === member.userId && (
                                <MemberContextMenu
                                    guildId={guildId}
                                    userId={member.userId}
                                    displayName={member.displayName}
                                    memberRoleIds={member.roles.map(r => r.id)}
                                    canManageRoles={permissions.isOwner || permissions.manageRoles}
                                    canKick={permissions.isOwner || permissions.kickMembers}
                                    canBan={permissions.isOwner || permissions.banMembers}
                                    onClose={() => setCtxMember(null)}
                                    onMemberRemoved={() => {
                                        setMembers(prev => prev.filter(m => m.userId !== member.userId));
                                    }}
                                    onRolesChanged={() => {
                                        getMembers(guildId).then(setMembers);
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
