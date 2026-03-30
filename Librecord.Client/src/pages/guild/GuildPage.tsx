import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useChannels } from "../../hooks/useChannels";
import { useGuildChannelMessages } from "../../hooks/useGuildChannelMessages";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useAttachmentUpload } from "../../hooks/useAttachmentUpload";
import { useChatChannel, type ChatChannelConfig } from "../../hooks/useChatChannel";
import { useGuildPermissions } from "../../hooks/useGuildPermissions";
import { useThreads } from "../../hooks/useThreads";
import { onCustomEvent } from "../../lib/typedEvent";
import type { AppEventMap } from "../../realtime/events";

import { MemberSidebar } from "../../components/guild/MemberSidebar";
import { InviteModal } from "../../components/guild/InviteModal";
import { SearchBar } from "../../components/messages/SearchBar";
import { PinnedMessagesPanel } from "../../components/messages/PinnedMessagesPanel";
import { ChatView } from "../../components/chat/ChatView";
import { ThreadPanel } from "../../components/messages/ThreadPanel";
import { VoiceChannelView } from "../../components/voice/VoiceChannelView";
import { Spinner } from "../../components/ui/Spinner";
import { PersonPlusIcon, PersonsIcon, PinIcon, ShieldIcon, VoiceChannelIcon } from "../../components/ui/Icons";

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
    const { createThread, getThreads } = useThreads();
    const [channelName, setChannelName] = useState<string | null>(null);
    const [channelTopic, setChannelTopic] = useState<string | null>(null);
    const [channelType, setChannelType] = useState<number>(0);
    const [showInvite, setShowInvite] = useState(false);
    const [showMembers, setShowMembers] = useState(true);
    const [activeThread, setActiveThread] = useState<{ id: string; name: string } | null>(null);
    const [threadMap, setThreadMap] = useState<Map<string, { threadId: string; threadName: string; messageCount: number }>>(new Map());
    const [threadPromptMsgId, setThreadPromptMsgId] = useState<string | null>(null);
    const [threadNameInput, setThreadNameInput] = useState("");

    const [metadataReady, setMetadataReady] = useState(false);

    const [prevChannelId, setPrevChannelId] = useState(channelId);
    if (channelId !== prevChannelId) {
        setPrevChannelId(channelId);
        setChannelName(null);
        setChannelTopic(null);
        setMetadataReady(false);
        setThreadMap(new Map());
        setActiveThread(null);
    }

    useEffect(() => {
        if (!channelId) return;
        let stale = false;
        getChannel(channelId).then(ch => {
            if (stale) return;
            setChannelName(ch?.name ?? null);
            setChannelTopic(ch?.topic ?? null);
            setChannelType(ch?.type ?? 0);
            setMetadataReady(true);
        });
        return () => { stale = true; };
    }, [channelId, getChannel]);

    const config: ChatChannelConfig = useMemo(() => ({
        channelId: metadataReady ? channelId : undefined,
        getMessages: getChannelMessages,
        sendTextMessage: async (chId, content, clientMsgId, replyToId) => { await createMessage(chId, content, clientMsgId, replyToId); },
        sendWithAttachments: sendGuildMessageWithAttachments,
        editMessage: async (messageId, dto) => {
            if (!channelId) throw new Error("No channelId");
            const updated = await guildEditMessage(channelId, messageId, dto.content);
            return { content: updated!.content, editedAt: updated!.editedAt };
        },
        deleteMessage: async (messageId) => {
            if (!channelId) throw new Error("No channelId");
            await guildDeleteMessage(channelId, messageId);
        },
        events: {
            messageNew: "guild:message:new",
            messageEdited: "guild:message:edited",
            messageDeleted: "guild:message:deleted",
        },
        typingScope: "guild",
    }), [metadataReady, channelId, getChannelMessages, createMessage, sendGuildMessageWithAttachments, guildEditMessage, guildDeleteMessage]);

    const chat = useChatChannel(config);

    // Load thread metadata for messages in this channel
    useEffect(() => {
        if (!channelId) return;
        let stale = false;
        getThreads(channelId).then(threads => {
            if (stale) return;
            const map = new Map<string, { threadId: string; threadName: string; messageCount: number }>();
            for (const t of threads) {
                map.set(t.parentMessageId, { threadId: t.id, threadName: t.name, messageCount: t.messageCount });
            }
            setThreadMap(map);
        });
        return () => { stale = true; };
    }, [channelId, getThreads]);

    // Update thread message count on real-time events
    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:thread:message:new"]>(
            "guild:thread:message:new",
            (detail) => {
                if (detail.channelId !== channelId) return;
                setThreadMap(prev => {
                    const next = new Map(prev);
                    for (const [msgId, info] of next) {
                        if (info.threadId === detail.threadId) {
                            next.set(msgId, { ...info, messageCount: info.messageCount + 1 });
                            break;
                        }
                    }
                    return next;
                });
            },
        );
    }, [channelId]);

    // Enrich messages with thread info
    const messagesWithThreads = useMemo(() => {
        if (threadMap.size === 0) return chat.messages;
        return chat.messages.map(msg => {
            const info = threadMap.get(msg.id);
            if (!info) return msg;
            return { ...msg, threadId: info.threadId, threadName: info.threadName, threadMessageCount: info.messageCount };
        });
    }, [chat.messages, threadMap]);

    const chatWithThreads = useMemo(() => ({
        ...chat,
        messages: messagesWithThreads,
    }), [chat, messagesWithThreads]);

    async function handleStartThread(messageId: string) {
        setThreadPromptMsgId(messageId);
        setThreadNameInput("");
    }

    async function handleCreateThread() {
        if (!channelId || !threadPromptMsgId || !threadNameInput.trim()) return;
        const thread = await createThread(channelId, threadPromptMsgId, threadNameInput.trim());
        setThreadPromptMsgId(null);
        if (thread) {
            setThreadMap(prev => {
                const next = new Map(prev);
                next.set(threadPromptMsgId, { threadId: thread.id, threadName: thread.name, messageCount: 0 });
                return next;
            });
            setActiveThread({ id: thread.id, name: thread.name });
        }
    }

    function handleOpenThread(messageId: string) {
        const info = threadMap.get(messageId);
        if (info) {
            setActiveThread({ id: info.threadId, name: info.threadName });
        }
    }

    if (!channelId) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400">
                Select a channel
            </div>
        );
    }

    if (!metadataReady) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#313338]">
                <Spinner className="text-[#949ba4]" />
            </div>
        );
    }

    const isVoice = channelType === 1;

    return (
        <div className="flex-1 flex bg-[#313338] overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <div className="page-header">
                    <span className="font-semibold flex items-center gap-1.5">
                        {isVoice ? (
                            <VoiceChannelIcon size={20} className="text-gray-400" />
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
                            className="icon-btn"
                            title="Invite People"
                        >
                            <PersonPlusIcon size={18} />
                        </button>

                        {!isVoice && (
                            <button
                                onClick={() => chat.setShowPins(v => !v)}
                                className={`p-2 rounded hover:bg-white/10 ${chat.showPins ? "text-white" : "text-gray-400 hover:text-white"}`}
                                title="Pinned Messages"
                            >
                                <PinIcon size={18} />
                            </button>
                        )}

                        <button
                            onClick={() => setShowMembers(v => !v)}
                            className={`p-2 rounded hover:bg-white/10 ${showMembers ? "text-white" : "text-gray-400 hover:text-white"}`}
                            title={showMembers ? "Hide Members" : "Show Members"}
                        >
                            <PersonsIcon size={18} />
                        </button>

                        {guildId && channelId && permissions.manageChannels && (
                            <Link
                                to={`/app/guild/${guildId}/${channelId}/permissions`}
                                className="icon-btn"
                                title="Channel Permissions"
                            >
                                <ShieldIcon size={18} />
                            </Link>
                        )}

                        {!isVoice && !chat.showPins && <SearchBar channelId={channelId} guildId={guildId} />}
                    </div>
                </div>

                {isVoice ? (
                    <VoiceChannelView
                        channelId={channelId}
                        channelName={channelName ?? "Voice Channel"}
                    />
                ) : (
                    <ChatView
                        chat={chatWithThreads}
                        currentUserId={user?.userId}
                        getAvatarUrl={getAvatarUrl}
                        inputPlaceholder={`Message #${channelName ?? ""}`}
                        canManageMessages={permissions.isOwner || permissions.manageMessages}
                        onStartThread={handleStartThread}
                        onOpenThread={handleOpenThread}
                    />
                )}
            </div>

            {chat.showPins && !isVoice && channelId && (
                <PinnedMessagesPanel channelId={channelId} onClose={() => chat.setShowPins(false)} />
            )}

            {activeThread && channelId && (
                <ThreadPanel
                    channelId={channelId}
                    threadId={activeThread.id}
                    threadName={activeThread.name}
                    onClose={() => setActiveThread(null)}
                />
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

            {threadPromptMsgId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setThreadPromptMsgId(null)}>
                    <div className="bg-[#313338] rounded-lg p-5 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-white mb-3">Start Thread</h3>
                        <input
                            autoFocus
                            value={threadNameInput}
                            onChange={e => setThreadNameInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleCreateThread(); }}
                            placeholder="Thread name"
                            maxLength={64}
                            className="w-full px-3 py-2 rounded bg-[#1e1f22] text-white text-sm outline-none border border-[#3f4147] focus:border-[#5865F2]"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setThreadPromptMsgId(null)} className="px-4 py-2 text-sm text-[#dbdee1] hover:underline">Cancel</button>
                            <button
                                onClick={handleCreateThread}
                                disabled={!threadNameInput.trim()}
                                className="px-4 py-2 text-sm bg-[#5865F2] text-white rounded hover:bg-[#4752c4] disabled:opacity-50"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
