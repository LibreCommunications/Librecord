import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useDirectMessages } from "../../hooks/useDirectMessages";
import { useDirectMessagesChannel, type DmChannel } from "../../hooks/useDirectMessagesChannel";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useAuth } from "../../hooks/useAuth";
import { useAttachmentUpload } from "../../hooks/useAttachmentUpload";
import { useChatChannel, type ChatChannelConfig } from "../../hooks/useChatChannel";
import { Spinner } from "../../components/ui/Spinner";
import { useVoice } from "../../hooks/useVoice";
import { VoiceChannelView } from "../../components/voice/VoiceChannelView";
import { VoiceChannelIcon } from "../../components/ui/Icons";

import { AddParticipantModal } from "./AddParticipantModal";
import { DmHeader } from "./DmHeader";
import { ChatView } from "../../components/chat/ChatView";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { PinnedMessagesPanel } from "../../components/messages/PinnedMessagesPanel";
import { userProfiles, API_URL } from "../../api/client";
import { useFriends } from "../../hooks/useFriends";
import { useBlocks } from "../../hooks/useBlocks";
import { useToast } from "../../hooks/useToast";
import type { UserProfile, UserSummary } from "../../types/user";

import type { AppEventMap } from "../../realtime/events";
import { onCustomEvent } from "../../lib/typedEvent";
import { logger } from "../../lib/logger";
import { STORAGE } from "../../lib/storageKeys";

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
    const [showMembers, setShowMembers] = useState(false);
    const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
    const [otherFriends, setOtherFriends] = useState<UserSummary[]>([]);
    const [showProfile, setShowProfile] = useState(() => localStorage.getItem(STORAGE.showDmProfile) !== "false");
    const [isBlocked, setIsBlocked] = useState(false);
    const [confirmDmAction, setConfirmDmAction] = useState<"block" | "unfriend" | null>(null);
    const { voiceState, startDmCall } = useVoice();
    const inCall = voiceState.isConnected && voiceState.channelId === dmId && !voiceState.guildId;
    const [showCallView, setShowCallView] = useState(inCall);
    if (!inCall && showCallView) setShowCallView(false);
    const { removeFriend } = useFriends();
    const { blockUser, unblockUser, isBlocked: checkBlocked } = useBlocks();
    const { toast } = useToast();

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
            // Load other user's profile + friends for 1-to-1 DMs
            if (!ch.isGroup) {
                const other = ch.members.find(m => m.id !== user?.userId);
                if (other) {
                    userProfiles.get(other.id).then(setOtherProfile).catch(e => logger.api.warn("Failed to load other user profile", e));
                    userProfiles.getFriends(other.id).then(setOtherFriends).catch(() => setOtherFriends([]));
                    checkBlocked(other.id).then(setIsBlocked);
                }
            } else {
                setOtherProfile(null);
                setOtherFriends([]);
            }
        });
        return () => { stale = true; };
    }, [dmId, getDmChannel, user?.userId, checkBlocked]);

    const config: ChatChannelConfig = useMemo(() => ({
        channelId: metadataReady ? dmId : undefined,
        getMessages: getChannelMessages,
        sendTextMessage: (chId, content, clientMsgId, replyToId) => sendMessage(chId, content, clientMsgId, replyToId),
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
        return onCustomEvent<AppEventMap["dm:channel:deleted"]>("dm:channel:deleted", (detail) => {
            if (detail.channelId !== dmId) return;
            navigate("/app/dm");
        });
    }, [dmId, navigate]);

    useEffect(() => {
        if (!dmId) return;

        const cleanups = [
            onCustomEvent<AppEventMap["dm:member:left"]>("dm:member:left", (detail) => {
                if (detail.channelId !== dmId) return;
                setChannel(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== detail.userId) } : prev);
            }),
            onCustomEvent<AppEventMap["dm:member:added"]>("dm:member:added", (detail) => {
                if (detail.channelId !== dmId) return;
                getDmChannel(dmId).then(ch => { if (ch) setChannel(ch); });
            }),
        ];
        return () => cleanups.forEach(fn => fn());
    }, [dmId, getDmChannel]);

    if (!dmId) return null;

    if (!metadataReady) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#313338]">
                <Spinner className="text-[#949ba4]" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex bg-[#313338] overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <div className="flex items-center border-b border-black/20">
                    <div className="flex-1">
                        <DmHeader
                            channelName={channelName}
                            isGroup={channel?.isGroup ?? false}
                            onAddMember={() => {
                                if (dmId) getDmChannel(dmId).then(ch => { if (ch) setChannel(ch); });
                                setShowAddModal(true);
                            }}
                            onLeave={() => setShowLeaveConfirm(true)}
                            onStartCall={dmId ? () => { startDmCall(dmId); setShowCallView(true); } : undefined}
                            inCall={inCall}
                        />
                    </div>
                    {!channel?.isGroup && (
                        <button
                            onClick={() => {
                                const next = !showProfile;
                                setShowProfile(next);
                                localStorage.setItem(STORAGE.showDmProfile, String(next));
                            }}
                            className={`p-2 rounded hover:bg-white/10 ${showProfile ? "text-white" : "text-gray-400 hover:text-white"}`}
                            title={showProfile ? "Hide Profile" : "Show Profile"}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </button>
                    )}
                    {channel?.isGroup && (
                        <button
                            onClick={() => setShowMembers(v => !v)}
                            className={`p-2 rounded hover:bg-white/10 ${showMembers ? "text-white" : "text-gray-400 hover:text-white"}`}
                            title="Members"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </button>
                    )}
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

                {inCall && (
                    <button
                        onClick={() => setShowCallView(v => !v)}
                        className="flex items-center gap-2 w-full px-4 py-2 bg-[#248046] hover:bg-[#1a6334] text-white text-sm font-medium transition-colors shrink-0"
                    >
                        <VoiceChannelIcon size={16} />
                        <span>{showCallView ? "Back to Messages" : "View Call"}</span>
                    </button>
                )}

                {inCall && showCallView ? (
                    <VoiceChannelView
                        channelId={dmId!}
                        channelName={channelName ?? "Call"}
                    />
                ) : (
                    <ChatView
                        chat={chat}
                        currentUserId={user?.userId}
                        getAvatarUrl={getAvatarUrl}
                        inputPlaceholder={`Message ${channelName ?? ""}`}
                    />
                )}

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
                            <div className="bg-[#313338] rounded-lg w-100 p-5" onClick={e => e.stopPropagation()}>
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

            {/* 1-to-1 DM: show other user's profile */}
            {showProfile && otherProfile && !channel?.isGroup && (
                <div className="w-70 bg-[#232428] border-l border-black/20 flex flex-col overflow-y-auto">
                    {/* Banner */}
                    <div className={`h-25 shrink-0 ${otherProfile.bannerUrl ? "" : "bg-[#5865F2]"}`}>
                        {otherProfile.bannerUrl && <img src={`${API_URL}${otherProfile.bannerUrl}`} className="w-full h-full object-cover" alt="" />}
                    </div>
                    {/* Avatar + Info */}
                    <div className="px-4 -mt-8">
                        <img
                            src={otherProfile.avatarUrl ? `${API_URL}${otherProfile.avatarUrl}` : "/default-avatar.png"}
                            className="w-16 h-16 rounded-full object-cover border-4 border-[#232428]"
                            alt=""
                        />
                    </div>
                    <div className="px-4 pt-1 pb-3">
                        <p className="text-base font-bold text-white">{otherProfile.displayName}</p>
                        <p className="text-xs text-[#949ba4]">@{otherProfile.username}</p>
                        {otherProfile.bio && (
                            <div className="mt-3 bg-[#1e1f22] rounded-lg px-3 py-2">
                                <p className="text-[10px] font-semibold text-[#b5bac1] uppercase mb-1">About Me</p>
                                <p className="text-xs text-[#dbdee1] whitespace-pre-wrap">{otherProfile.bio}</p>
                            </div>
                        )}
                        <div className="mt-3 text-[10px] text-[#949ba4]">
                            Member since {new Date(otherProfile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                        </div>

                        {/* Mutual Friends */}
                        {otherProfile.mutualFriendCount != null && otherProfile.mutualFriendCount > 0 && (
                            <div className="mt-3 bg-[#1e1f22] rounded-lg px-3 py-2">
                                <p className="text-[10px] font-semibold text-[#b5bac1] uppercase mb-1.5">
                                    Mutual Friends — {otherProfile.mutualFriendCount}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {otherFriends
                                        .filter(f => f.id !== user?.userId)
                                        .slice(0, 10)
                                        .map(f => (
                                            <div key={f.id} className="flex items-center gap-1.5 bg-[#2b2d31] rounded-full pl-0.5 pr-2 py-0.5">
                                                <img
                                                    src={getAvatarUrl(f.avatarUrl ?? null)}
                                                    alt={f.displayName}
                                                    className="w-4 h-4 rounded-full object-cover"
                                                />
                                                <span className="text-[10px] text-[#dbdee1] truncate max-w-[60px]">{f.displayName}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Friend List */}
                        {otherProfile.friendsVisible && otherFriends.length > 0 && (
                            <div className="mt-3 bg-[#1e1f22] rounded-lg px-3 py-2">
                                <p className="text-[10px] font-semibold text-[#b5bac1] uppercase mb-1.5">
                                    Friends — {otherFriends.length}
                                </p>
                                <div className="space-y-1 max-h-40 overflow-y-auto dark-scrollbar">
                                    {otherFriends.map(f => (
                                        <div
                                            key={f.id}
                                            className="flex items-center gap-2 py-1 px-1 rounded hover:bg-[#2b2d31] cursor-pointer"
                                            onClick={() => window.dispatchEvent(new CustomEvent("user:profile:open", { detail: { userId: f.id } }))}
                                        >
                                            <img
                                                src={getAvatarUrl(f.avatarUrl ?? null)}
                                                alt={f.displayName}
                                                className="w-6 h-6 rounded-full object-cover shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-xs text-[#dbdee1] truncate">{f.displayName}</p>
                                                <p className="text-[10px] text-[#949ba4] truncate">@{f.username}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-1.5 mt-3">
                            {isBlocked ? (
                                <button
                                    onClick={async () => {
                                        if (await unblockUser(otherProfile.id)) {
                                            setIsBlocked(false);
                                            toast(`${otherProfile.displayName} unblocked.`, "success");
                                        }
                                    }}
                                    className="w-full py-1.5 rounded text-xs font-medium bg-[#248046] text-white hover:bg-[#1a6334] transition-colors"
                                >
                                    Unblock
                                </button>
                            ) : (
                                <>
                                    {otherProfile.isFriend && (
                                        <button
                                            onClick={() => setConfirmDmAction("unfriend")}
                                            className="w-full py-1.5 rounded text-xs font-medium bg-[#2b2d31] text-[#f23f43] hover:bg-[#da373c] hover:text-white transition-colors"
                                        >
                                            Remove Friend
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setConfirmDmAction("block")}
                                        className="w-full py-1.5 rounded text-xs font-medium bg-[#2b2d31] text-[#949ba4] hover:text-[#f23f43] transition-colors"
                                    >
                                        Block
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showMembers && channel?.isGroup && (
                <div className="w-60 bg-[#2b2d31] border-l border-black/20 flex flex-col overflow-y-auto">
                    <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase">
                        Members — {channel.members.length}
                    </div>
                    {channel.members.map(m => (
                        <div key={m.id} className="flex items-center gap-2 px-4 py-1.5 rounded hover:bg-white/5 mx-2">
                            <img
                                src={getAvatarUrl(m.avatarUrl)}
                                alt={m.displayName}
                                className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0">
                                <div className="text-sm text-gray-200 truncate">{m.displayName}</div>
                                <div className="text-xs text-[#949ba4] truncate">@{m.username}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {otherProfile && confirmDmAction === "unfriend" && (
                <ConfirmModal
                    open
                    title={`Remove ${otherProfile.displayName}`}
                    description={`Are you sure you want to remove ${otherProfile.displayName} as a friend?`}
                    confirmLabel="Remove Friend"
                    confirmVariant="danger"
                    onConfirm={async () => {
                        await removeFriend(otherProfile.id);
                        setOtherProfile(p => p ? { ...p, isFriend: false } : p);
                        toast("Friend removed.", "info");
                        setConfirmDmAction(null);
                    }}
                    onCancel={() => setConfirmDmAction(null)}
                />
            )}

            {otherProfile && confirmDmAction === "block" && (
                <ConfirmModal
                    open
                    title={`Block ${otherProfile.displayName}`}
                    description={`Are you sure you want to block ${otherProfile.displayName}? ${otherProfile.isFriend ? "This will also remove them as a friend. " : ""}They won't be able to message you.`}
                    confirmLabel="Block"
                    confirmVariant="danger"
                    onConfirm={async () => {
                        if (await blockUser(otherProfile.id)) {
                            setIsBlocked(true);
                            setOtherProfile(p => p ? { ...p, isFriend: false } : p);
                            toast(`${otherProfile.displayName} blocked.`, "info");
                        }
                        setConfirmDmAction(null);
                    }}
                    onCancel={() => setConfirmDmAction(null)}
                />
            )}
        </div>
    );
}
