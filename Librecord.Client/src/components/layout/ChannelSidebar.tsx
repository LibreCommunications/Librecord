import { Link, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useChannels, type GuildChannel } from "../../hooks/useChannels";
import { useReadState } from "../../hooks/useReadState";
import { useVoice } from "../../hooks/useVoice";
import { UnreadBadge } from "../ui/UnreadBadge";
import CreateChannelModal from "../../pages/guild/CreateChannelModal";
import type { GuildEventMap } from "../../realtime/guild/guildEvents";
import { useAuth } from "../../hooks/useAuth";
import { useUserProfile } from "../../hooks/useUserProfile";
import { fetchWithAuth } from "../../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;
const MANAGE_CHANNELS_PERMISSION_ID = "11111111-1111-1111-1111-111111111104";

interface Props {
    guildId: string;
}

export default function ChannelSidebar({ guildId }: Props) {
    const { channelId } = useParams();
    const navigate = useNavigate();
    const { getGuildChannels, createChannel } = useChannels();
    const { getUnreadCounts } = useReadState();
    const { voiceState, joinVoice } = useVoice();
    const { user } = useAuth();
    const { getAvatarUrl } = useUserProfile();

    const [channels, setChannels] = useState<GuildChannel[]>([]);
    const [unreads, setUnreads] = useState<Record<string, number>>({});
    const [loadedGuildId, setLoadedGuildId] = useState<string | null>(null);
    const loading = loadedGuildId !== guildId;
    const [showCreate, setShowCreate] = useState(false);
    const [canManageChannels, setCanManageChannels] = useState(false);
    const [channelParticipants, setChannelParticipants] = useState<Record<string, { userId: string; username: string; displayName: string; avatarUrl: string | null; isMuted: boolean; isDeafened: boolean }[]>>({});

    const loadChannels = useCallback(async function loadChannels() {
        const list = await getGuildChannels(guildId);
        setChannels(list);
        setLoadedGuildId(guildId);

        if (list.length > 0) {
            const counts = await getUnreadCounts(list.map(c => c.id));
            setUnreads(counts);
        }

        // Check if current user can manage channels
        try {
            const [membersRes, rolesRes] = await Promise.all([
                fetchWithAuth(`${API_URL}/guilds/${guildId}/members`, {}),
                fetchWithAuth(`${API_URL}/guilds/${guildId}/roles`, {}),
            ]);
            if (membersRes.ok && rolesRes.ok) {
                const members = await membersRes.json();
                const roles = await rolesRes.json();
                const me = members.find((m: { userId: string }) => m.userId === user?.userId);
                const myRoleIds = new Set((me?.roles ?? []).map((r: { id: string }) => r.id));
                const hasManage = roles
                    .filter((r: { id: string }) => myRoleIds.has(r.id))
                    .some((r: { permissions: { permissionId: string; allow: boolean }[] }) =>
                        r.permissions.some(p => p.permissionId === MANAGE_CHANNELS_PERMISSION_ID && p.allow)
                    );
                setCanManageChannels(hasManage);
            }
        } catch {
            setCanManageChannels(false);
        }
    }, [guildId, getGuildChannels, getUnreadCounts, user?.userId]);

    useEffect(() => {
        if (!guildId) return;
        let cancelled = false;
        (async () => {
            const list = await getGuildChannels(guildId);
            if (cancelled) return;
            setChannels(list);
            setLoadedGuildId(guildId);

            if (list.length > 0) {
                const counts = await getUnreadCounts(list.map(c => c.id));
                if (!cancelled) setUnreads(counts);
            }

            try {
                const [membersRes, rolesRes] = await Promise.all([
                    fetchWithAuth(`${API_URL}/guilds/${guildId}/members`, {}),
                    fetchWithAuth(`${API_URL}/guilds/${guildId}/roles`, {}),
                ]);
                if (!cancelled && membersRes.ok && rolesRes.ok) {
                    const members = await membersRes.json();
                    const roles = await rolesRes.json();
                    const me = members.find((m: { userId: string }) => m.userId === user?.userId);
                    const myRoleIds = new Set((me?.roles ?? []).map((r: { id: string }) => r.id));
                    const hasManage = roles
                        .filter((r: { id: string }) => myRoleIds.has(r.id))
                        .some((r: { permissions: { permissionId: string; allow: boolean }[] }) =>
                            r.permissions.some(p => p.permissionId === MANAGE_CHANNELS_PERMISSION_ID && p.allow)
                        );
                    setCanManageChannels(hasManage);
                }
            } catch {
                if (!cancelled) setCanManageChannels(false);
            }
        })();
        return () => { cancelled = true; };
    }, [guildId, getGuildChannels, getUnreadCounts, user?.userId]);

    // Fetch voice participants for all voice channels
    useEffect(() => {
        const voiceChs = channels.filter(c => c.type === 1);
        if (voiceChs.length === 0) return;
        Promise.all(
            voiceChs.map(ch =>
                fetchWithAuth(`${API_URL}/voice/channels/${ch.id}/participants`, {})
                    .then(r => r.ok ? r.json() : [])
                    .then(participants => [ch.id, participants] as const)
            )
        ).then(results => {
            const map: typeof channelParticipants = {};
            for (const [id, p] of results) map[id] = p;
            setChannelParticipants(map);
        });
    }, [channels]);

    // Update participant list on voice join/leave/state events
    useEffect(() => {
        const onJoin = (e: CustomEvent<GuildEventMap["voice:user:joined"]>) => {
            const p = e.detail;
            setChannelParticipants(prev => ({
                ...prev,
                [p.channelId]: [...(prev[p.channelId] ?? []).filter(x => x.userId !== p.userId), p],
            }));
        };
        const onLeave = (e: CustomEvent<GuildEventMap["voice:user:left"]>) => {
            const { channelId: chId, userId } = e.detail;
            setChannelParticipants(prev => ({
                ...prev,
                [chId]: (prev[chId] ?? []).filter(x => x.userId !== userId),
            }));
        };
        window.addEventListener("voice:user:joined", onJoin as EventListener);
        window.addEventListener("voice:user:left", onLeave as EventListener);
        return () => {
            window.removeEventListener("voice:user:joined", onJoin as EventListener);
            window.removeEventListener("voice:user:left", onLeave as EventListener);
        };
    }, []);

    // Increment unread when a message ping arrives for a non-active channel
    useEffect(() => {
        const onPing = (e: CustomEvent<GuildEventMap["guild:message:ping"]>) => {
            const { channelId: pingChannel, authorId } = e.detail;
            if (pingChannel === channelId) return;
            if (authorId === user?.userId) return;

            setUnreads(prev => ({
                ...prev,
                [pingChannel]: (prev[pingChannel] ?? 0) + 1,
            }));
        };

        window.addEventListener("guild:message:ping", onPing as EventListener);
        return () => window.removeEventListener("guild:message:ping", onPing as EventListener);
    }, [channelId, user?.userId]);

    // Clear unread count when navigating into a channel (render-phase)
    const [prevActiveChannelId, setPrevActiveChannelId] = useState(channelId);
    if (channelId && channelId !== prevActiveChannelId) {
        setPrevActiveChannelId(channelId);
        if (unreads[channelId]) {
            const next = { ...unreads };
            delete next[channelId];
            setUnreads(next);
        }
    }

    async function handleCreateChannel(data: {
        name: string;
        type: number;
        topic?: string | null;
    }) {
        await createChannel(guildId, { ...data, position: channels.length });
        await loadChannels();
    }

    const textChannels = channels.filter(c => c.type === 0);
    const voiceChannels = channels.filter(c => c.type === 1);

    return (
        <>
            <aside className="w-60 bg-[#2b2d31] border-r border-black/20 flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto dark-scrollbar pt-3">
                    {loading && <div className="text-xs text-gray-500 px-4 py-2">Loading channels…</div>}

                    {!loading && (
                        <>
                            <div className="flex items-center justify-between px-3 pb-0.5 pt-4 first:pt-0">
                                <h2 className="text-[#949ba4] uppercase text-[11px] font-bold tracking-wide">Text Channels</h2>
                                {canManageChannels && (
                                    <button
                                        onClick={() => setShowCreate(true)}
                                        className="text-[#949ba4] hover:text-[#dbdee1] text-base leading-none"
                                        title="Create channel"
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                            {textChannels.map(ch => {
                                const unreadCount = unreads[ch.id] ?? 0;
                                const isActive = channelId === ch.id;
                                const hasUnread = unreadCount > 0 && !isActive;

                                return (
                                    <Link key={ch.id} to={`/app/guild/${guildId}/${ch.id}`}>
                                        <div
                                            className={`
                                                group relative flex items-center gap-1.5
                                                mx-2 px-1.5 py-[6px] cursor-pointer
                                                rounded-[4px]
                                                hover:bg-[#35373c]
                                                ${isActive ? "bg-[#404249] text-white" : "text-[#949ba4] hover:text-[#dbdee1]"}
                                                ${hasUnread ? "text-[#f2f3f5]" : ""}
                                            `}
                                        >
                                            {isActive && (
                                                <span className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-2 bg-white rounded-r-full" />
                                            )}
                                            {hasUnread && !isActive && (
                                                <span className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-2 bg-white rounded-r-full" />
                                            )}
                                            <span className="text-[18px] leading-none opacity-60">#</span>
                                            <span className={`truncate flex-1 text-[15px] leading-5 ${hasUnread ? "font-medium" : ""}`}>{ch.name}</span>
                                            {hasUnread && (
                                                <UnreadBadge count={unreadCount} />
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}

                            <div className="flex items-center justify-between px-3 pb-0.5 pt-4">
                                <h2 className="text-[#949ba4] uppercase text-[11px] font-bold tracking-wide">Voice Channels</h2>
                                {canManageChannels && (
                                    <button
                                        onClick={() => setShowCreate(true)}
                                        className="text-[#949ba4] hover:text-[#dbdee1] text-base leading-none"
                                        title="Create channel"
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                            {voiceChannels.map(ch => {
                                const isInVoiceChannel = voiceState.isConnected && voiceState.channelId === ch.id;
                                const voiceParticipants = channelParticipants[ch.id] ?? [];

                                return (
                                    <div key={ch.id}>
                                        <div
                                            onClick={() => {
                                                navigate(`/app/guild/${guildId}/${ch.id}`);
                                                if (!isInVoiceChannel) {
                                                    joinVoice(ch.id, guildId);
                                                }
                                            }}
                                            className={`
                                                group relative flex items-center gap-1.5
                                                mx-2 px-1.5 py-[6px] cursor-pointer
                                                rounded-[4px]
                                                hover:bg-[#35373c]
                                                ${isInVoiceChannel || channelId === ch.id ? "bg-[#404249] text-white" : "text-[#949ba4] hover:text-[#dbdee1]"}
                                            `}
                                        >
                                            {isInVoiceChannel && (
                                                <span className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-2 bg-white rounded-r-full" />
                                            )}
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60">
                                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                            </svg>
                                            <span className="truncate flex-1 text-[15px] leading-5">{ch.name}</span>
                                        </div>
                                        {voiceParticipants.length > 0 && (
                                            <div className="ml-[42px] mr-2 mt-0.5 mb-1 space-y-px">
                                                {voiceParticipants.map(p => (
                                                    <div key={p.userId} className="flex items-center gap-1.5 text-[13px] text-[#949ba4] py-[3px]">
                                                        <img
                                                            src={getAvatarUrl(p.avatarUrl)}
                                                            alt=""
                                                            className="w-5 h-5 rounded-full object-cover shrink-0"
                                                        />
                                                        <span className="truncate">{p.displayName}</span>
                                                        {p.isMuted && (
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
                                                                <line x1="1" y1="1" x2="23" y2="23" />
                                                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </aside>

            <CreateChannelModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreate={handleCreateChannel}
            />
        </>
    );
}
