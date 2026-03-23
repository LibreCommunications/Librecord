import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useChannels } from "../../hooks/useChannels";
import { useGuildChannelMessages } from "../../hooks/useGuildChannelMessages";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useAttachmentUpload } from "../../hooks/useAttachmentUpload";
import { useChatChannel, type ChatChannelConfig } from "../../hooks/useChatChannel";
import { useGuildPermissions } from "../../hooks/useGuildPermissions";

import { MemberSidebar } from "../../components/guild/MemberSidebar";
import { InviteModal } from "../../components/guild/InviteModal";
import { SearchBar } from "../../components/messages/SearchBar";
import { PinnedMessagesPanel } from "../../components/messages/PinnedMessagesPanel";
import { ChatView } from "../../components/chat/ChatView";
import { VoiceChannelView } from "../../components/voice/VoiceChannelView";

export default function GuildChannelPage() {
    const { guildId, channelId } = useParams<{ guildId: string; channelId: string }>();

    const { user } = useAuth();
    const { getAvatarUrl } = useUserProfile();
    const { getChannel } = useChannels();

    const {
        getChannelMessages,
        createMessage,
        editMessage: guildEditMessage,
        deleteMessage: guildDeleteMessage,
    } = useGuildChannelMessages();
    const { sendGuildMessageWithAttachments } = useAttachmentUpload();
    const { permissions } = useGuildPermissions(guildId);

    const [channelName, setChannelName] = useState<string | null>(null);
    const [channelTopic, setChannelTopic] = useState<string | null>(null);
    const [channelType, setChannelType] = useState<number>(0);
    const [showInvite, setShowInvite] = useState(false);
    const [showMembers, setShowMembers] = useState(true);

    // ── Build config for the shared chat hook ────────────
    const config: ChatChannelConfig = useMemo(() => ({
        channelId,
        getMessages: getChannelMessages,
        sendTextMessage: async (chId, content, clientMsgId) => { await createMessage(chId, content, clientMsgId); },
        sendWithAttachments: sendGuildMessageWithAttachments,
        editMessage: async (messageId, dto) => {
            const updated = await guildEditMessage(channelId!, messageId, dto.content);
            return { content: updated!.content, editedAt: updated!.editedAt };
        },
        deleteMessage: async (messageId) => { await guildDeleteMessage(channelId!, messageId); },
        events: {
            messageNew: "guild:message:new",
            messageEdited: "guild:message:edited",
            messageDeleted: "guild:message:deleted",
        },
        typingScope: "guild",
    }), [channelId, getChannelMessages, createMessage, sendGuildMessageWithAttachments, guildEditMessage, guildDeleteMessage]);

    const chat = useChatChannel(config);

    // ── Load guild channel metadata ──────────────────────
    const [prevChannelId, setPrevChannelId] = useState(channelId);
    if (channelId !== prevChannelId) {
        setPrevChannelId(channelId);
        setChannelName(null);
        setChannelTopic(null);
    }

    useEffect(() => {
        if (!channelId) return;
        let stale = false;
        getChannel(channelId).then(ch => {
            if (stale) return;
            setChannelName(ch?.name ?? null);
            setChannelTopic(ch?.topic ?? null);
            setChannelType(ch?.type ?? 0);
        });
        return () => { stale = true; };
    }, [channelId, getChannel]);

    if (!channelId) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400">
                Select a channel
            </div>
        );
    }

    const isVoice = channelType === 1;

    return (
        <div className="flex-1 flex bg-[#313338] overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                {/* HEADER */}
                <div className="h-12 flex items-center justify-between border-b border-black/20 px-4 shrink-0">
                    <span className="font-semibold flex items-center gap-1.5">
                        {isVoice ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                        ) : (
                            <span className="text-gray-400">#</span>
                        )}
                        {channelName ?? "channel"}
                    </span>
                    {channelTopic && (
                        <>
                            <div className="w-px h-5 bg-[#3f4147] mx-2" />
                            <span className="text-sm text-[#949ba4] truncate max-w-xs" title={channelTopic}>
                                {channelTopic}
                            </span>
                        </>
                    )}
                    <div className="flex-1" />
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => setShowInvite(true)}
                            className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                            title="Invite People"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <line x1="20" y1="8" x2="20" y2="14" />
                                <line x1="23" y1="11" x2="17" y2="11" />
                            </svg>
                        </button>

                        {!isVoice && (
                            <button
                                onClick={() => chat.setShowPins(v => !v)}
                                className={`p-2 rounded hover:bg-white/10 ${chat.showPins ? "text-white" : "text-gray-400 hover:text-white"}`}
                                title="Pinned Messages"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="17" x2="12" y2="22" />
                                    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                </svg>
                            </button>
                        )}

                        <button
                            onClick={() => setShowMembers(v => !v)}
                            className={`p-2 rounded hover:bg-white/10 ${showMembers ? "text-white" : "text-gray-400 hover:text-white"}`}
                            title={showMembers ? "Hide Members" : "Show Members"}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </button>

                        {guildId && channelId && (
                            <Link
                                to={`/app/guild/${guildId}/${channelId}/permissions`}
                                className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                                title="Channel Permissions"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </Link>
                        )}

                        {guildId && (permissions.manageGuild || permissions.manageRoles) && (
                            <Link
                                to={`/app/guild/${guildId}/settings`}
                                className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                                title="Server Settings"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                            </Link>
                        )}

                        {!isVoice && !chat.showPins && <SearchBar channelId={channelId} guildId={guildId} />}
                    </div>
                </div>

                {/* CONTENT: voice grid or text messages */}
                {isVoice ? (
                    <VoiceChannelView
                        channelId={channelId}
                        channelName={channelName ?? "Voice Channel"}
                    />
                ) : (
                    <ChatView
                        chat={chat}
                        currentUserId={user?.userId}
                        getAvatarUrl={getAvatarUrl}
                        inputPlaceholder={`Message #${channelName ?? ""}`}
                    />
                )}
            </div>

            {chat.showPins && !isVoice && channelId && (
                <PinnedMessagesPanel channelId={channelId} onClose={() => chat.setShowPins(false)} />
            )}

            {showMembers && guildId && (
                <MemberSidebar guildId={guildId} />
            )}

            {showInvite && guildId && (
                <InviteModal
                    guildId={guildId}
                    onClose={() => setShowInvite(false)}
                />
            )}
        </div>
    );
}
