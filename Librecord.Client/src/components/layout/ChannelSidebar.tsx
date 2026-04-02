import { Link, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useChannels, type GuildChannel } from "../../hooks/useChannels";
import { useUnreadContext } from "../../context/UnreadContext";
import { useVoice } from "../../hooks/useVoice";
import { useGuildPermissions } from "../../hooks/useGuildPermissions";
import { useToast } from "../../hooks/useToast";
import { UnreadBadge } from "../ui/UnreadBadge";
import { ConfirmModal } from "../ui/ConfirmModal";
import CreateChannelModal from "../../pages/guild/CreateChannelModal";
import { onCustomEvent, onEvent } from "../../lib/typedEvent";
import type { AppEventMap } from "../../realtime/events";
import { useAuth } from "../../hooks/useAuth";
import { useUserProfile } from "../../hooks/useUserProfile";
import { voice } from "../../api/client";
import { VoiceParticipantList } from "./VoiceParticipantList";
import { EditChannelModal } from "./EditChannelModal";
import { PlusIcon, SettingsIcon, VoiceChannelIcon, ChevronDownIcon } from "../ui/Icons";

interface Props {
    guildId: string;
}

export default function ChannelSidebar({ guildId }: Props) {
    const { channelId } = useParams();
    const navigate = useNavigate();
    const { getGuildChannels, createChannel, updateChannel, deleteChannel } = useChannels();
    const { counts: unreads, fetchUnreads, clearChannel, setActiveChannel } = useUnreadContext();
    const { voiceState, joinVoice } = useVoice();
    const { user } = useAuth();
    const { getAvatarUrl } = useUserProfile();
    const { permissions } = useGuildPermissions(guildId);
    const { toast } = useToast();

    const [channels, setChannels] = useState<GuildChannel[]>([]);
    const [loadedGuildId, setLoadedGuildId] = useState<string | null>(null);
    const loading = loadedGuildId !== guildId;
    const [showCreate, setShowCreate] = useState(false);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channel: GuildChannel } | null>(null);
    const [editTarget, setEditTarget] = useState<GuildChannel | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<GuildChannel | null>(null);
    const [channelParticipants, setChannelParticipants] = useState<Record<string, { userId: string; username: string; displayName: string; avatarUrl: string | null; isMuted: boolean; isDeafened: boolean; isCameraOn: boolean; isScreenSharing: boolean }[]>>({});

    // Clear unreads for active channel
    useEffect(() => {
        if (channelId) {
            setActiveChannel(channelId);
            clearChannel(channelId);
        }
        return () => setActiveChannel(undefined);
    }, [channelId, setActiveChannel, clearChannel]);

    const loadChannels = useCallback(async function loadChannels() {
        const list = await getGuildChannels(guildId);
        setChannels(list);
        setLoadedGuildId(guildId);

        if (list.length > 0) {
            await fetchUnreads(list.map(c => c.id));
        }
    }, [guildId, getGuildChannels, fetchUnreads]);

    useEffect(() => {
        if (!guildId) return;
        Promise.resolve().then(loadChannels);
    }, [guildId, loadChannels]);

    useEffect(() => {
        const refresh = () => { loadChannels(); };
        const cleanups = [
            onEvent("realtime:reconnected", refresh),
            onCustomEvent<AppEventMap["guild:channel:created"]>("guild:channel:created", (detail) => {
                if (detail.guildId !== guildId) return;
                setChannels(prev => {
                    // Skip if already present (avoids duplicate from loadChannels + event race)
                    if (prev.some(c => c.id === detail.channelId)) return prev;
                    return [...prev, { id: detail.channelId, name: detail.name, type: detail.type, position: detail.position, parentId: detail.parentId, guildId }];
                });
            }),
            onCustomEvent<AppEventMap["guild:channel:updated"]>("guild:channel:updated", (detail) => {
                if (detail.guildId !== guildId) return;
                setChannels(prev => prev.map(c => c.id === detail.channelId ? { ...c, name: detail.name, parentId: detail.parentId ?? c.parentId } : c));
            }),
            onCustomEvent<AppEventMap["guild:channel:deleted"]>("guild:channel:deleted", (detail) => {
                if (detail.guildId !== guildId) return;
                setChannels(prev => prev.filter(c => c.id !== detail.channelId));
                if (channelId === detail.channelId) navigate(`/app/guild/${guildId}`);
            }),
        ];
        return () => cleanups.forEach(fn => fn());
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
        return onEvent("realtime:reconnected", fetchVoiceParticipants);
    }, [fetchVoiceParticipants]);

    useEffect(() => {
        const cleanups = [
            onCustomEvent<AppEventMap["voice:user:joined"]>("voice:user:joined", (p) => {
                setChannelParticipants(prev => ({
                    ...prev,
                    [p.channelId]: [...(prev[p.channelId] ?? []).filter(x => x.userId !== p.userId), p],
                }));
            }),
            onCustomEvent<AppEventMap["voice:user:left"]>("voice:user:left", (detail) => {
                const { channelId: chId, userId } = detail;
                setChannelParticipants(prev => ({
                    ...prev,
                    [chId]: (prev[chId] ?? []).filter(x => x.userId !== userId),
                }));
            }),
            onCustomEvent<AppEventMap["voice:user:state"]>("voice:user:state", (detail) => {
                const { channelId: chId, userId, isMuted, isDeafened, isCameraOn, isScreenSharing } = detail;
                setChannelParticipants(prev => ({
                    ...prev,
                    [chId]: (prev[chId] ?? []).map(x =>
                        x.userId === userId ? { ...x, isMuted, isDeafened, isCameraOn, isScreenSharing } : x
                    ),
                }));
            }),
        ];
        return () => cleanups.forEach(fn => fn());
    }, []);

    const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});
    useEffect(() => {
        return onCustomEvent<{ identity: string; speaking: boolean }>("voice:speaking:changed", (detail) => {
            setSpeakingMap(prev => ({ ...prev, [detail.identity]: detail.speaking }));
        });
    }, []);

    // Unread increments and clearing are handled by UnreadContext

    async function handleCreateChannel(data: {
        name: string;
        type: number;
        topic?: string | null;
        parentId?: string | null;
    }) {
        await createChannel(guildId, { ...data, position: channels.length });
        // No loadChannels() call — the guild:channel:created event handles adding it
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
            <aside aria-label="Channel navigation" role="navigation" className="w-60 shrink-0 bg-[#2b2d31] border-r border-black/20 flex-1 flex flex-col">
                <div className="flex items-center justify-between px-3 h-12 border-b border-black/20 shrink-0">
                    <span className="text-white font-semibold text-sm truncate">Channels</span>
                    <div className="flex items-center gap-1">
                        {permissions.manageChannels && (
                            <button
                                onClick={() => setShowCreate(true)}
                                className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]"
                                title="Create channel"
                                aria-label="Create channel"
                                data-testid="create-channel-btn"
                            >
                                <PlusIcon size={16} />
                            </button>
                        )}
                        {(permissions.isOwner || permissions.manageGuild || permissions.manageRoles) && (
                            <Link
                                to={`/app/guild/${guildId}/settings`}
                                className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]"
                                title="Guild Settings"
                                aria-label="Guild Settings"
                                data-testid="guild-settings-link"
                            >
                                <SettingsIcon size={16} />
                            </Link>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto dark-scrollbar pt-2" data-testid="channel-list" role="list" aria-label="Channel list">
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
                                        data-testid={isVoice ? `voice-channel-${ch.id}` : `text-channel-${ch.id}`}
                                        role="listitem"
                                        className={`group relative flex items-center gap-1.5 mx-2 px-1.5 py-[6px] cursor-pointer rounded-[4px] hover:bg-[#35373c]
                                            ${isActive || isInVoiceChannel ? "bg-[#404249] text-white" : "text-[#949ba4] hover:text-[#dbdee1]"}
                                            ${hasUnread ? "text-[#f2f3f5]" : ""}`}
                                    >
                                        {(isActive || (hasUnread && !isActive) || isInVoiceChannel) && (
                                            <span className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-2 bg-white rounded-r-full" />
                                        )}
                                        {isVoice ? (
                                            <VoiceChannelIcon size={18} className="shrink-0 opacity-60" />
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
                                        <VoiceParticipantList
                                            participants={voiceParticipants}
                                            localUserId={user?.userId}
                                            voiceState={voiceState}
                                            channelId={ch.id}
                                            speakingMap={speakingMap}
                                            getAvatarUrl={getAvatarUrl}
                                        />
                                    </div>
                                );
                            })}

                            {/* Categories */}
                            {categories.map((cat, catIdx) => {
                                const children = getChildChannels(cat.id);
                                const isCollapsed = collapsedCategories.has(cat.id);
                                return (
                                    <div key={cat.id} className={(catIdx > 0 || uncategorized.length > 0) ? "mt-3" : ""}>
                                        <div
                                            className="flex items-center gap-0.5 px-1 py-0.5 cursor-pointer text-[#949ba4] hover:text-[#dbdee1]"
                                            onClick={() => toggleCategory(cat.id)}
                                            onContextMenu={e => { if (!permissions.manageChannels) return; e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, channel: cat }); }}
                                        >
                                            <ChevronDownIcon size={12} className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                                            <span className="uppercase text-xs font-bold tracking-wide truncate">{cat.name}</span>
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
                                                    data-testid={isVoice ? `voice-channel-${ch.id}` : `text-channel-${ch.id}`}
                                                    role="listitem"
                                                    className={`group relative flex items-center gap-1.5 mx-2 px-1.5 py-[6px] cursor-pointer rounded-[4px] hover:bg-[#35373c]
                                                        ${active || isInVC ? "bg-[#404249] text-white" : "text-[#949ba4] hover:text-[#dbdee1]"}
                                                        ${unread ? "text-[#f2f3f5]" : ""}`}
                                                >
                                                    {isVoice ? (
                                                        <VoiceChannelIcon size={18} className="shrink-0 opacity-60" />
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
                                                    <VoiceParticipantList
                                                        participants={vp}
                                                        localUserId={user?.userId}
                                                        voiceState={voiceState}
                                                        channelId={ch.id}
                                                        speakingMap={speakingMap}
                                                        getAvatarUrl={getAvatarUrl}
                                                    />
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
                        role="menu"
                        aria-label="Channel actions"
                    >
                        <button
                            role="menuitem"
                            onClick={() => {
                                setEditTarget(ctxMenu.channel);
                                setCtxMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-[#4752c4] hover:text-white rounded-[3px] mx-1"
                        >
                            {ctxMenu.channel.type === 2 ? "Edit Category" : "Edit Channel"}
                        </button>
                        <button
                            role="menuitem"
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
            <EditChannelModal
                target={editTarget}
                categories={categories}
                onSave={async (channelId, data) => {
                    await updateChannel(channelId, data);
                    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, name: data.name, parentId: data.parentId ?? c.parentId } : c));
                    toast(editTarget?.type === 2 ? "Category updated!" : "Channel updated!", "success");
                    setEditTarget(null);
                }}
                onClose={() => setEditTarget(null)}
            />

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
