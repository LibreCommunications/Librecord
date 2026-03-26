import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useDirectMessages } from "../../hooks/useDirectMessages";
import { useDirectMessagesChannel, type DmChannel } from "../../hooks/useDirectMessagesChannel";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useAuth } from "../../hooks/useAuth";
import { useAttachmentUpload } from "../../hooks/useAttachmentUpload";
import { useChatChannel, type ChatChannelConfig } from "../../hooks/useChatChannel";

import { AddParticipantModal } from "./AddParticipantModal";
import { DmHeader } from "./DmHeader";
import { ChatView } from "../../components/chat/ChatView";
import { PinnedMessagesPanel } from "../../components/messages/PinnedMessagesPanel";

import type { AppEventMap } from "../../realtime/events";

export default function DmConversationPage() {
    const { dmId } = useParams();
    const navigate = useNavigate();

    const { user } = useAuth();
    const { getAvatarUrl } = useUserProfile();

    const {
        getChannelMessages,
        sendMessage,
        editMessage: dmEditMessage,
        deleteMessage: dmDeleteMessage,
    } = useDirectMessages();

    const { getDmChannel, leaveChannel } = useDirectMessagesChannel();
    const { sendDmMessageWithAttachments } = useAttachmentUpload();

    const [channel, setChannel] = useState<DmChannel | null>(null);
    const [channelName, setChannelName] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    // Load metadata before messages to avoid concurrent requests competing
    // for browser connection slots (max 6, minus 2 WebSockets = 4 free)
    const [metadataReady, setMetadataReady] = useState(false);

    const [prevDmId, setPrevDmId] = useState(dmId);
    if (dmId !== prevDmId) {
        setPrevDmId(dmId);
        setChannel(null);
        setChannelName(null);
        setMetadataReady(false);
    }

    useEffect(() => {
        if (!dmId) return;
        let stale = false;
        getDmChannel(dmId).then(ch => {
            if (stale) return;
            if (!ch) return;
            setChannel(ch);
            if (ch.isGroup) {
                setChannelName(ch.name ?? "Unnamed Group");
            } else {
                const others = ch.members.filter(m => m.id !== user?.userId);
                setChannelName(others.length ? others.map(o => o.displayName).join(", ") : "Direct Message");
            }
            setMetadataReady(true);
        });
        return () => { stale = true; };
    }, [dmId, getDmChannel, user?.userId]);

    const config: ChatChannelConfig = useMemo(() => ({
        channelId: metadataReady ? dmId : undefined,
        getMessages: getChannelMessages,
        sendTextMessage: sendMessage,
        sendWithAttachments: sendDmMessageWithAttachments,
        editMessage: async (messageId, dto) => {
            const updated = await dmEditMessage(messageId, dto.content);
            return { content: updated.content, editedAt: updated.editedAt };
        },
        deleteMessage: dmDeleteMessage,
        events: {
            messageNew: "dm:message:new",
            messageEdited: "dm:message:edited",
            messageDeleted: "dm:message:deleted",
        },
        typingScope: "dm",
    }), [metadataReady, dmId, getChannelMessages, sendMessage, sendDmMessageWithAttachments, dmEditMessage, dmDeleteMessage]);

    const chat = useChatChannel(config);

    useEffect(() => {
        if (!dmId) return;
        const handler = (event: CustomEvent<AppEventMap["dm:channel:deleted"]>) => {
            if (event.detail.channelId !== dmId) return;
            navigate("/app/dm");
        };
        window.addEventListener("dm:channel:deleted", handler as EventListener);
        return () => window.removeEventListener("dm:channel:deleted", handler as EventListener);
    }, [dmId, navigate]);

    useEffect(() => {
        if (!dmId) return;

        const onLeft = (event: CustomEvent<AppEventMap["dm:member:left"]>) => {
            if (event.detail.channelId !== dmId) return;
            setChannel(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== event.detail.userId) } : prev);
        };
        const onAdded = (event: CustomEvent<AppEventMap["dm:member:added"]>) => {
            if (event.detail.channelId !== dmId) return;
            getDmChannel(dmId).then(ch => { if (ch) setChannel(ch); });
        };

        window.addEventListener("dm:member:left", onLeft as EventListener);
        window.addEventListener("dm:member:added", onAdded as EventListener);
        return () => {
            window.removeEventListener("dm:member:left", onLeft as EventListener);
            window.removeEventListener("dm:member:added", onAdded as EventListener);
        };
    }, [dmId, getDmChannel]);

    if (!dmId) return null;

    return (
        <div className="flex-1 flex bg-[#313338] overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <div className="flex items-center border-b border-black/20">
                    <div className="flex-1">
                        <DmHeader
                            channelName={channelName}
                            isGroup={channel?.isGroup ?? false}
                            onAddMember={() => setShowAddModal(true)}
                            onLeave={() => setShowLeaveConfirm(true)}
                        />
                    </div>
                    <button
                        onClick={() => chat.setShowPins(v => !v)}
                        className={`p-2 mr-2 rounded hover:bg-white/10 ${chat.showPins ? "text-white" : "text-gray-400 hover:text-white"}`}
                        title="Pinned Messages"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="17" x2="12" y2="22" />
                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                        </svg>
                    </button>
                </div>

                <ChatView
                    chat={chat}
                    currentUserId={user?.userId}
                    getAvatarUrl={getAvatarUrl}
                    inputPlaceholder={`Message ${channelName ?? ""}`}
                />

                {showAddModal && channel && (
                    <AddParticipantModal
                        channelId={channel.id}
                        members={channel.members}
                        onClose={() => setShowAddModal(false)}
                    />
                )}

                {showLeaveConfirm && (() => {
                    const isLast = channel && channel.members.length <= 1;
                    return (
                        <div className="modal-overlay" onClick={() => setShowLeaveConfirm(false)}>
                            <div className="bg-[#313338] rounded-lg w-[400px] p-5" onClick={e => e.stopPropagation()}>
                                <h3 className="text-white text-lg font-semibold mb-2">Leave Group</h3>
                                <p className="text-[#949ba4] text-sm mb-5">
                                    {isLast
                                        ? "You are the last member. Leaving will permanently delete this group and all its messages and attachments."
                                        : "Are you sure you want to leave this group? You won't be able to rejoin unless someone adds you back."}
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setShowLeaveConfirm(false)} className="btn-text">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setShowLeaveConfirm(false);
                                            if (await leaveChannel(dmId)) navigate("/app/dm");
                                        }}
                                        className="btn-danger"
                                    >
                                        Leave Group
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {chat.showPins && dmId && (
                <PinnedMessagesPanel channelId={dmId} onClose={() => chat.setShowPins(false)} />
            )}
        </div>
    );
}
