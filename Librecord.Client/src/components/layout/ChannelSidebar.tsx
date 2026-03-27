import { Link, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useChannels, type GuildChannel } from "../../hooks/useChannels";
import { useReadState } from "../../hooks/useReadState";
import { useVoice } from "../../hooks/useVoice";
import { useGuildPermissions } from "../../hooks/useGuildPermissions";
import { UnreadBadge } from "../ui/UnreadBadge";
import CreateChannelModal from "../../pages/guild/CreateChannelModal";
import type { AppEventMap } from "../../realtime/events";
import { useAuth } from "../../hooks/useAuth";
import { useUserProfile } from "../../hooks/useUserProfile";
import { guilds as guildsApi, roles as rolesApi, voice } from "../../api/client";

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
    const { permissions } = useGuildPermissions(guildId);

    const [channels, setChannels] = useState<GuildChannel[]>([]);
    const [unreads, setUnreads] = useState<Record<string, number>>({});
    const [loadedGuildId, setLoadedGuildId] = useState<string | null>(null);
    const loading = loadedGuildId !== guildId;
    const [showCreate, setShowCreate] = useState(false);
    const [canManageChannels, setCanManageChannels] = useState(false);
    const [channelParticipants, setChannelParticipants] = useState<Record<string, { userId: string; username: string; displayName: string; avatarUrl: string | null; isMuted: boolean; isDeafened: boolean; isCameraOn: boolean; isScreenSharing: boolean }[]>>({});

    const loadChannels = useCallback(async function loadChannels() {
        const list = await getGuildChannels(guildId);
        setChannels(list);
        setLoadedGuildId(guildId);

        if (list.length > 0) {
            const counts = await getUnreadCounts(list.map(c => c.id));
            setUnreads(counts);
        }

        try {
            const [members, guildRoles] = await Promise.all([
                guildsApi.members(guildId),
                rolesApi.list(guildId),
            ]);
            const me = members.find(m => m.userId === user?.userId);
            const myRoleIds = new Set((me?.roles ?? []).map(r => r.id));
            const hasManage = guildRoles
                .filter(r => myRoleIds.has(r.id))
                .some(r =>
                    (r.permissions ?? []).some(p => p.permissionId === MANAGE_CHANNELS_PERMISSION_ID && p.allow)
                );
            setCanManageChannels(hasManage);
        } catch {
            setCanManageChannels(false);
        }
    }, [guildId, getGuildChannels, getUnreadCounts, user?.userId]);

    useEffect(() => {
        if (!guildId) return;
        Promise.resolve().then(loadChannels);
    }, [guildId, loadChannels]);

    useEffect(() => {
        const refresh = () => { loadChannels(); };
        window.addEventListener("realtime:reconnected", refresh);
        return () => window.removeEventListener("realtime:reconnected", refresh);
    }, [loadChannels]);

    const fetchVoiceParticipants = useCallback(() => {
        const voiceChs = channels.filter(c => c.type === 1);
        if (voiceChs.length === 0) return;
        Promise.all(
            voiceChs.map(ch =>
                voice.participants(ch.id)
                    .then(participants => [ch.id, participants] as const)
            )
        ).then(results => {
            const map: typeof channelParticipants = {};
            for (const [id, p] of results) map[id] = p;
            setChannelParticipants(map);
        });
    }, [channels]);

    useEffect(() => {
        fetchVoiceParticipants();

        window.addEventListener("realtime:reconnected", fetchVoiceParticipants);
        return () => window.removeEventListener("realtime:reconnected", fetchVoiceParticipants);
    }, [fetchVoiceParticipants]);

    useEffect(() => {
        const onJoin = (e: CustomEvent<AppEventMap["voice:user:joined"]>) => {
            const p = e.detail;
            setChannelParticipants(prev => ({
                ...prev,
                [p.channelId]: [...(prev[p.channelId] ?? []).filter(x => x.userId !== p.userId), p],
            }));
        };
        const onLeave = (e: CustomEvent<AppEventMap["voice:user:left"]>) => {
            const { channelId: chId, userId } = e.detail;
            setChannelParticipants(prev => ({
                ...prev,
                [chId]: (prev[chId] ?? []).filter(x => x.userId !== userId),
            }));
        };
        const onState = (e: CustomEvent<AppEventMap["voice:user:state"]>) => {
            const { channelId: chId, userId, isMuted, isDeafened, isCameraOn, isScreenSharing } = e.detail;
            setChannelParticipants(prev => ({
                ...prev,
                [chId]: (prev[chId] ?? []).map(x =>
                    x.userId === userId ? { ...x, isMuted, isDeafened, isCameraOn, isScreenSharing } : x
                ),
            }));
        };
        window.addEventListener("voice:user:joined", onJoin as EventListener);
        window.addEventListener("voice:user:left", onLeave as EventListener);
        window.addEventListener("voice:user:state", onState as EventListener);
        return () => {
            window.removeEventListener("voice:user:joined", onJoin as EventListener);
            window.removeEventListener("voice:user:left", onLeave as EventListener);
            window.removeEventListener("voice:user:state", onState as EventListener);
        };
    }, []);

    const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ identity: string; speaking: boolean }>).detail;
            if (detail) {
                setSpeakingMap(prev => ({ ...prev, [detail.identity]: detail.speaking }));
            }
        };
        window.addEventListener("voice:speaking:changed", handler);
        return () => window.removeEventListener("voice:speaking:changed", handler);
    }, []);

    useEffect(() => {
        const onPing = (e: CustomEvent<AppEventMap["guild:message:ping"]>) => {
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
                <div className="flex items-center justify-between px-3 py-2 border-b border-black/20 shrink-0">
                    <span className="text-white font-semibold text-sm truncate">Channels</span>
                    <div className="flex items-center gap-1">
                        {canManageChannels && (
                            <button
                                onClick={() => setShowCreate(true)}
                                className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]"
                                title="Create channel"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                        )}
                        {permissions.isOwner && (
                            <Link
                                to={`/app/guild/${guildId}/settings`}
                                className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]"
                                title="Server Settings"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                            </Link>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto dark-scrollbar pt-3">
                    {loading && <div className="text-xs text-gray-500 px-4 py-2">Loading channels…</div>}

                    {!loading && (
                        <>
                            <div className="px-3 pb-0.5">
                                <h2 className="text-[#949ba4] uppercase text-[11px] font-bold tracking-wide">Text Channels</h2>
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

                            <div className="px-3 pb-0.5 pt-4">
                                <h2 className="text-[#949ba4] uppercase text-[11px] font-bold tracking-wide">Voice Channels</h2>
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
                                            <div className="ml-7 mr-2 mt-0.5 mb-1 space-y-px">
                                                {voiceParticipants.map(raw => {
                                                    // For the local user, voiceState is the source of truth
                                                    const isLocal = raw.userId === user?.userId && isInVoiceChannel;
                                                    const p = isLocal ? { ...raw, isMuted: voiceState.isMuted, isDeafened: voiceState.isDeafened, isCameraOn: voiceState.isCameraOn, isScreenSharing: voiceState.isScreenSharing } : raw;
                                                    const isSpeaking = speakingMap[p.userId] ?? false;
                                                    return (
                                                        <div key={p.userId} className="flex items-center gap-1.5 text-[13px] text-[#949ba4] py-[3px]">
                                                            <img
                                                                src={getAvatarUrl(p.avatarUrl)}
                                                                alt=""
                                                                className={`
                                                                    w-5 h-5 rounded-full object-cover shrink-0
                                                                    transition-shadow duration-150
                                                                    ${isSpeaking ? "shadow-[0_0_0_2px_#23a55a]" : ""}
                                                                `}
                                                            />
                                                            <span className="truncate flex-1">{p.displayName}</span>
                                                            <span className="flex items-center gap-0.5 shrink-0">
                                                                {p.isScreenSharing && (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#5865f2]">
                                                                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                                                        <line x1="8" y1="21" x2="16" y2="21" />
                                                                        <line x1="12" y1="17" x2="12" y2="21" />
                                                                    </svg>
                                                                )}
                                                                {p.isCameraOn && (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#dbdee1]">
                                                                        <polygon points="23 7 16 12 23 17 23 7" />
                                                                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                                                    </svg>
                                                                )}
                                                                {p.isMuted && (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                                                                        <line x1="1" y1="1" x2="23" y2="23" />
                                                                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                                                                    </svg>
                                                                )}
                                                                {p.isDeafened && (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                                                                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                                                        <line x1="1" y1="1" x2="23" y2="23" />
                                                                    </svg>
                                                                )}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
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
