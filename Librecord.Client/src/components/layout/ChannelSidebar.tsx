import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useChannels, type GuildChannel } from "../../hooks/useChannels";
import { useReadState } from "../../hooks/useReadState";
import { useVoice } from "../../hooks/useVoice";
import { UnreadBadge } from "../ui/UnreadBadge";
import CreateChannelModal from "../../pages/guild/CreateChannelModal";
import type { GuildEventMap } from "../../realtime/guild/guildEvents";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../hooks/useUserProfile";

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
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    async function loadChannels() {
        setLoading(true);
        const list = await getGuildChannels(guildId);
        setChannels(list);
        setLoading(false);

        if (list.length > 0) {
            const counts = await getUnreadCounts(list.map(c => c.id));
            setUnreads(counts);
        }
    }

    useEffect(() => {
        if (!guildId) return;
        loadChannels();
    }, [guildId]);

    // Increment unread when a new guild message arrives for a non-active channel
    useEffect(() => {
        const onNewMessage = (e: CustomEvent<GuildEventMap["guild:message:new"]>) => {
            const { message } = e.detail;
            if (message.channelId === channelId) return;
            if (message.author.id === user?.userId) return;

            setUnreads(prev => ({
                ...prev,
                [message.channelId]: (prev[message.channelId] ?? 0) + 1,
            }));
        };

        window.addEventListener("guild:message:new", onNewMessage as EventListener);
        return () => window.removeEventListener("guild:message:new", onNewMessage as EventListener);
    }, [channelId, user?.userId]);

    // Clear unread when navigating into a channel
    useEffect(() => {
        if (!channelId) return;
        setUnreads(prev => {
            if (!prev[channelId]) return prev;
            const next = { ...prev };
            delete next[channelId];
            return next;
        });
    }, [channelId]);

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
                <div className="flex-1 overflow-auto pt-3">
                    {loading && <div className="text-xs text-gray-500 px-4 py-2">Loading channels…</div>}

                    {!loading && (
                        <>
                            <div className="flex items-center justify-between px-3 pb-0.5 pt-4 first:pt-0">
                                <h2 className="text-[#949ba4] uppercase text-[11px] font-bold tracking-wide">Text Channels</h2>
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="text-[#949ba4] hover:text-[#dbdee1] text-base leading-none"
                                    title="Create channel"
                                >
                                    +
                                </button>
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
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="text-[#949ba4] hover:text-[#dbdee1] text-base leading-none"
                                    title="Create channel"
                                >
                                    +
                                </button>
                            </div>
                            {voiceChannels.map(ch => {
                                const isInVoiceChannel = voiceState.isConnected && voiceState.channelId === ch.id;
                                const voiceParticipants = isInVoiceChannel ? voiceState.participants : [];

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
