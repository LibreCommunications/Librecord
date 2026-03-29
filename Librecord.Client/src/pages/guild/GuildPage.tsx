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
    const [channelName, setChannelName] = useState<string | null>(null);
    const [channelTopic, setChannelTopic] = useState<string | null>(null);
    const [channelType, setChannelType] = useState<number>(0);
    const [showInvite, setShowInvite] = useState(false);
    const [showMembers, setShowMembers] = useState(true);

    const [metadataReady, setMetadataReady] = useState(false);

    const [prevChannelId, setPrevChannelId] = useState(channelId);
    if (channelId !== prevChannelId) {
        setPrevChannelId(channelId);
        setChannelName(null);
        setChannelTopic(null);
        setMetadataReady(false);
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
                        chat={chat}
                        currentUserId={user?.userId}
                        getAvatarUrl={getAvatarUrl}
                        inputPlaceholder={`Message #${channelName ?? ""}`}
                        canManageMessages={permissions.isOwner || permissions.manageMessages}
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
