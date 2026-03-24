import { useEffect, useState } from "react";
import { useGuildMembers, type GuildMember } from "../../hooks/useGuildMembers";
import { useUserProfile } from "../../hooks/useUserProfile";
import { StatusDot } from "../user/StatusDot";
import { fetchWithAuth } from "../../api/fetchWithAuth";
import type { AppEventMap } from "../../realtime/events";

const API_URL = import.meta.env.VITE_API_URL;

interface Props {
    guildId: string;
}

export function MemberSidebar({ guildId }: Props) {
    const { getMembers } = useGuildMembers();
    const { getAvatarUrl } = useUserProfile();
    const [members, setMembers] = useState<GuildMember[]>([]);
    const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});

    useEffect(() => {
        getMembers(guildId).then(async (m) => {
            setMembers(m);

            // Fetch bulk presence
            const userIds = m.map(member => member.userId);
            const res = await fetchWithAuth(
                `${API_URL}/presence/bulk`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIds }),
                },
            );

            if (res.ok) {
                const data = await res.json();
                setPresenceMap(data);
            }
        });
    }, [guildId, getMembers]);

    // Listen for realtime presence changes
    useEffect(() => {
        const onPresence = (e: CustomEvent<AppEventMap["guild:user:presence"]>) => {
            setPresenceMap(prev => ({
                ...prev,
                [e.detail.userId]: e.detail.status,
            }));
        };

        window.addEventListener("guild:user:presence", onPresence as EventListener);
        return () => window.removeEventListener("guild:user:presence", onPresence as EventListener);
    }, []);

    // Group by highest role
    const grouped = new Map<string, GuildMember[]>();

    for (const member of members) {
        const roleName = member.roles.length > 0
            ? member.roles[0].name
            : "Members";

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
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer"
                        >
                            <div className="relative flex-shrink-0">
                                <img
                                    src={getAvatarUrl(member.avatarUrl)}
                                    alt={member.displayName}
                                    className="w-8 h-8 rounded-full bg-gray-600"
                                />
                                <span className="absolute -bottom-0.5 -right-0.5">
                                    <StatusDot
                                        status={presenceMap[member.userId] ?? "offline"}
                                    />
                                </span>
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm text-gray-200 truncate">
                                    {member.displayName}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
