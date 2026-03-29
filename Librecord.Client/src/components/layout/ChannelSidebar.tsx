import { Link, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useChannels, type GuildChannel } from "../../hooks/useChannels";
import { useReadState } from "../../hooks/useReadState";
import { useVoice } from "../../hooks/useVoice";
import { useGuildPermissions } from "../../hooks/useGuildPermissions";
import { useToast } from "../../hooks/useToast";
import { UnreadBadge } from "../ui/UnreadBadge";
import { ConfirmModal } from "../ui/ConfirmModal";
import CreateChannelModal from "../../pages/guild/CreateChannelModal";
import type { AppEventMap } from "../../realtime/events";
import { useAuth } from "../../hooks/useAuth";
import { useUserProfile } from "../../hooks/useUserProfile";
import { voice } from "../../api/client";

interface Props {
    guildId: string;
}

export default function ChannelSidebar({ guildId }: Props) {
    const { channelId } = useParams();
    const navigate = useNavigate();
    const { getGuildChannels, createChannel, updateChannel, deleteChannel } = useChannels();
    const { getUnreadCounts } = useReadState();
    const { voiceState, joinVoice } = useVoice();
    const { user } = useAuth();
    const { getAvatarUrl } = useUserProfile();
    const { permissions } = useGuildPermissions(guildId);
    const { toast } = useToast();

    const [channels, setChannels] = useState<GuildChannel[]>([]);
    const [unreads, setUnreads] = useState<Record<string, number>>({});
    const [loadedGuildId, setLoadedGuildId] = useState<string | null>(null);
    const loading = loadedGuildId !== guildId;
    const [showCreate, setShowCreate] = useState(false);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channel: GuildChannel } | null>(null);
    const [editTarget, setEditTarget] = useState<GuildChannel | null>(null);
    const [editName, setEditName] = useState("");
    const [editTopic, setEditTopic] = useState("");
    const [editParentId, setEditParentId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<GuildChannel | null>(null);
    const [channelParticipants, setChannelParticipants] = useState<Record<string, { userId: string; username: string; displayName: string; avatarUrl: string | null; isMuted: boolean; isDeafened: boolean; isCameraOn: boolean; isScreenSharing: boolean }[]>>({});

    const loadChannels = useCallback(async function loadChannels() {
        const list = await getGuildChannels(guildId);
        setChannels(list);
        setLoadedGuildId(guildId);

        if (list.length > 0) {
            const counts = await getUnreadCounts(list.map(c => c.id));
            setUnreads(counts);
        }
    }, [guildId, getGuildChannels, getUnreadCounts]);

    useEffect(() => {
        if (!guildId) return;
        Promise.resolve().then(loadChannels);
    }, [guildId, loadChannels]);

    useEffect(() => {
        const refresh = () => { loadChannels(); };
        const onCreated = (e: CustomEvent<AppEventMap["guild:channel:created"]>) => {
            if (e.detail.guildId !== guildId) return;
            setChannels(prev => [...prev, { id: e.detail.channelId, name: e.detail.name, type: e.detail.type, position: e.detail.position, parentId: e.detail.parentId, guildId }]);
        };
        const onUpdated = (e: CustomEvent<AppEventMap["guild:channel:updated"]>) => {
            if (e.detail.guildId !== guildId) return;
            setChannels(prev => prev.map(c => c.id === e.detail.channelId ? { ...c, name: e.detail.name, parentId: e.detail.parentId } : c));
        };
        const onDeleted = (e: CustomEvent<AppEventMap["guild:channel:deleted"]>) => {
            if (e.detail.guildId !== guildId) return;
            setChannels(prev => prev.filter(c => c.id !== e.detail.channelId));
            if (channelId === e.detail.channelId) navigate(`/app/guild/${guildId}`);
        };
        window.addEventListener("realtime:reconnected", refresh);
        window.addEventListener("guild:channel:created", onCreated as EventListener);
        window.addEventListener("guild:channel:updated", onUpdated as EventListener);
        window.addEventListener("guild:channel:deleted", onDeleted as EventListener);
        return () => {
            window.removeEventListener("realtime:reconnected", refresh);
            window.removeEventListener("guild:channel:created", onCreated as EventListener);
            window.removeEventListener("guild:channel:updated", onUpdated as EventListener);
            window.removeEventListener("guild:channel:deleted", onDeleted as EventListener);
        };
    }, [loadChannels, guildId, channelId, navigate]);

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
        parentId?: string | null;
    }) {
        await createChannel(guildId, { ...data, position: channels.length });
        await loadChannels();
    }

    const categories = channels.filter(c => c.type === 2);
    const uncategorized = channels.filter(c => c.type !== 2 && !c.parentId);

    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const toggleCategory = (id: string) => setCollapsedCategories(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    function getChildChannels(categoryId: string) {
        return channels.filter(c => c.parentId === categoryId && c.type !== 2);
    }

    return (
        <>
            <aside className="w-60 bg-[#2b2d31] border-r border-black/20 flex-1 flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b border-black/20 shrink-0">
                    <span className="text-white font-semibold text-sm truncate">Channels</span>
                    <div className="flex items-center gap-1">
                        {permissions.manageChannels && (
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
                        {(permissions.isOwner || permissions.manageGuild || permissions.manageRoles) && (
                            <Link
                                to={`/app/guild/${guildId}/settings`}
                                className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]"
                                title="Guild Settings"
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
                            {/* Uncategorized channels */}
                            {uncategorized.map(ch => {
                                const isVoice = ch.type === 1;
                                const isInVoiceChannel = isVoice && voiceState.isConnected && voiceState.channelId === ch.id;
                                const voiceParticipants = isVoice ? (channelParticipants[ch.id] ?? []) : [];
                                const unreadCount = unreads[ch.id] ?? 0;
                                const isActive = channelId === ch.id;
                                const hasUnread = unreadCount > 0 && !isActive;

                                const channelRow = (
                                    <div
                                        onClick={isVoice ? () => { navigate(`/app/guild/${guildId}/${ch.id}`); if (!isInVoiceChannel) joinVoice(ch.id, guildId); } : undefined}
                                        onContextMenu={e => { if (!permissions.manageChannels) return; e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, channel: ch }); }}
                                        className={`group relative flex items-center gap-1.5 mx-2 px-1.5 py-[6px] cursor-pointer rounded-[4px] hover:bg-[#35373c]
                                            ${isActive || isInVoiceChannel ? "bg-[#404249] text-white" : "text-[#949ba4] hover:text-[#dbdee1]"}
                                            ${hasUnread ? "text-[#f2f3f5]" : ""}`}
                                    >
                                        {(isActive || (hasUnread && !isActive) || isInVoiceChannel) && (
                                            <span className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-2 bg-white rounded-r-full" />
                                        )}
                                        {isVoice ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60">
                                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                            </svg>
                                        ) : (
                                            <span className="text-[18px] leading-none opacity-60">#</span>
                                        )}
                                        <span className={`truncate flex-1 text-[15px] leading-5 ${hasUnread ? "font-medium" : ""}`}>{ch.name}</span>
                                        {hasUnread && !isVoice && <UnreadBadge count={unreadCount} />}
                                    </div>
                                );

                                return (
                                    <div key={ch.id}>
                                        {isVoice ? channelRow : <Link to={`/app/guild/${guildId}/${ch.id}`}>{channelRow}</Link>}
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

                            {/* Categories */}
                            {categories.map(cat => {
                                const children = getChildChannels(cat.id);
                                const isCollapsed = collapsedCategories.has(cat.id);
                                return (
                                    <div key={cat.id} className="mt-3">
                                        <div
                                            className="flex items-center gap-0.5 px-1 py-0.5 cursor-pointer text-[#949ba4] hover:text-[#dbdee1]"
                                            onClick={() => toggleCategory(cat.id)}
                                            onContextMenu={e => { if (!permissions.manageChannels) return; e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, channel: cat }); }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                            <span className="uppercase text-[11px] font-bold tracking-wide truncate">{cat.name}</span>
                                        </div>
                                        {!isCollapsed && children.map(ch => {
                                            const isVoice = ch.type === 1;
                                            const isInVC = isVoice && voiceState.isConnected && voiceState.channelId === ch.id;
                                            const vp = isVoice ? (channelParticipants[ch.id] ?? []) : [];
                                            const uc = unreads[ch.id] ?? 0;
                                            const active = channelId === ch.id;
                                            const unread = uc > 0 && !active;

                                            const row = (
                                                <div
                                                    onClick={isVoice ? () => { navigate(`/app/guild/${guildId}/${ch.id}`); if (!isInVC) joinVoice(ch.id, guildId); } : undefined}
                                                    onContextMenu={e => { if (!permissions.manageChannels) return; e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, channel: ch }); }}
                                                    className={`group relative flex items-center gap-1.5 mx-2 px-1.5 py-[6px] cursor-pointer rounded-[4px] hover:bg-[#35373c]
                                                        ${active || isInVC ? "bg-[#404249] text-white" : "text-[#949ba4] hover:text-[#dbdee1]"}
                                                        ${unread ? "text-[#f2f3f5]" : ""}`}
                                                >
                                                    {isVoice ? (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60">
                                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                                        </svg>
                                                    ) : (
                                                        <span className="text-[18px] leading-none opacity-60">#</span>
                                                    )}
                                                    <span className={`truncate flex-1 text-[15px] leading-5 ${unread ? "font-medium" : ""}`}>{ch.name}</span>
                                                    {unread && !isVoice && <UnreadBadge count={uc} />}
                                                </div>
                                            );

                                            return (
                                                <div key={ch.id}>
                                                    {isVoice ? row : <Link to={`/app/guild/${guildId}/${ch.id}`}>{row}</Link>}
                                                    {vp.length > 0 && (
                                                        <div className="ml-7 mr-2 mt-0.5 mb-1 space-y-px">
                                                            {vp.map(p => (
                                                                <div key={p.userId} className="flex items-center gap-1.5 text-[13px] text-[#949ba4] py-[3px]">
                                                                    <img src={getAvatarUrl(p.avatarUrl)} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />
                                                                    <span className="truncate">{p.displayName}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </aside>

            <CreateChannelModal
                open={showCreate}
                categories={categories}
                onClose={() => setShowCreate(false)}
                onCreate={handleCreateChannel}
            />

            {/* Channel context menu */}
            {ctxMenu && (
                <>
                    <div className="fixed inset-0 z-[998]" onClick={() => setCtxMenu(null)} />
                    <div
                        className="fixed z-[999] bg-[#111214] rounded-lg shadow-xl py-1 min-w-[160px] border border-[#2b2d31]"
                        style={{ top: ctxMenu.y, left: ctxMenu.x }}
                    >
                        <button
                            onClick={() => {
                                setEditTarget(ctxMenu.channel);
                                setEditName(ctxMenu.channel.name);
                                setEditTopic((ctxMenu.channel as GuildChannel & { topic?: string }).topic ?? "");
                                setEditParentId(ctxMenu.channel.parentId ?? null);
                                setCtxMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-[#4752c4] hover:text-white rounded-[3px] mx-1"
                        >
                            {ctxMenu.channel.type === 2 ? "Edit Category" : "Edit Channel"}
                        </button>
                        <button
                            onClick={() => {
                                setDeleteTarget(ctxMenu.channel);
                                setCtxMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-[#f23f43] hover:bg-[#da373c] hover:text-white rounded-[3px] mx-1"
                        >
                            {ctxMenu.channel.type === 2 ? "Delete Category" : "Delete Channel"}
                        </button>
                    </div>
                </>
            )}

            {/* Edit channel/category modal */}
            {editTarget && (
                <>
                    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center" onClick={() => setEditTarget(null)}>
                        <div className="bg-[#313338] rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                            <h2 className="text-lg font-bold text-white mb-4">
                                {editTarget.type === 2 ? "Edit Category" : "Edit Channel"}
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-1">
                                        {editTarget.type === 2 ? "Category Name" : "Channel Name"}
                                    </label>
                                    <input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        maxLength={64}
                                        className="w-full bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 outline-none border border-[#3f4147] focus:border-[#5865F2]"
                                    />
                                </div>
                                {editTarget.type !== 2 && (
                                    <div>
                                        <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-1">Topic</label>
                                        <input
                                            value={editTopic}
                                            onChange={e => setEditTopic(e.target.value)}
                                            maxLength={1024}
                                            placeholder="What's this channel about?"
                                            className="w-full bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 outline-none border border-[#3f4147] focus:border-[#5865F2]"
                                        />
                                    </div>
                                )}
                                {editTarget.type !== 2 && categories.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-1">Category</label>
                                        <select
                                            value={editParentId ?? ""}
                                            onChange={e => setEditParentId(e.target.value || null)}
                                            className="w-full bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 outline-none border border-[#3f4147] focus:border-[#5865F2]"
                                        >
                                            <option value="">No category</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm text-white hover:underline">Cancel</button>
                                <button
                                    onClick={async () => {
                                        if (!editName.trim()) return;
                                        if (editTarget.type === 2) {
                                            await updateChannel(editTarget.id, { name: editName.trim() });
                                            setChannels(prev => prev.map(c => c.id === editTarget.id ? { ...c, name: editName.trim() } : c));
                                        } else {
                                            await updateChannel(editTarget.id, { name: editName.trim(), topic: editTopic.trim() || null, parentId: editParentId });
                                            setChannels(prev => prev.map(c => c.id === editTarget.id ? { ...c, name: editName.trim(), parentId: editParentId } : c));
                                        }
                                        toast(editTarget.type === 2 ? "Category updated!" : "Channel updated!", "success");
                                        setEditTarget(null);
                                    }}
                                    className="px-4 py-2 rounded bg-[#5865F2] text-white text-sm font-medium hover:bg-[#4752c4]"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Delete channel confirm */}
            <ConfirmModal
                open={!!deleteTarget}
                title="Delete Channel"
                description={`Are you sure you want to delete #${deleteTarget?.name}? This cannot be undone.`}
                confirmLabel="Delete"
                confirmVariant="danger"
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    const deleted = await deleteChannel(deleteTarget.id);
                    if (deleted) {
                        setChannels(prev => prev.filter(c => c.id !== deleteTarget.id));
                        toast("Channel deleted.", "info");
                        if (channelId === deleteTarget.id) navigate(`/app/guild/${guildId}`);
                    }
                    setDeleteTarget(null);
                }}
                onCancel={() => setDeleteTarget(null)}
            />
        </>
    );
}
