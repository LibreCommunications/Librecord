import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BanIcon, PhoneIcon } from "../ui/Icons";
import { userProfiles, API_URL } from "@librecord/api-client";
import { ConfirmModal } from "../ui/ConfirmModal";
import type { UserSummary } from "@librecord/domain";
import { DEFAULT_AVATAR } from "@librecord/domain";
import { useFriends } from "@librecord/app";
import { useBlocks } from "@librecord/app";
import { useDirectMessagesChannel } from "@librecord/app";
import { useVoice } from "@librecord/app";
import { useToast } from "@librecord/app";
import type { UserProfile } from "@librecord/domain";

interface Props {
    userId: string;
    onClose: () => void;
}

export function UserProfilePopup({ userId, onClose }: Props) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [friends, setFriends] = useState<UserSummary[] | null>(null);
    const [showFriends, setShowFriends] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [confirmAction, setConfirmAction] = useState<"block" | "unfriend" | null>(null);
    const { sendRequest: sendFriendRequest, removeFriend } = useFriends();
    const { blockUser, unblockUser, isBlocked: checkBlocked } = useBlocks();
    const { startDm } = useDirectMessagesChannel();
    const { startDmCall, voiceState } = useVoice();
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        userProfiles.get(userId).then(p => { setProfile(p); setLoading(false); }).catch(() => setLoading(false));
        checkBlocked(userId).then(setIsBlocked);
    }, [userId, checkBlocked]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center" onClick={onClose}>
                <div className="bg-[#232428] rounded-xl w-[360px] p-6 text-center" onClick={e => e.stopPropagation()}>
                    <div className="w-8 h-8 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
            </div>
        );
    }

    if (!profile) {
        onClose();
        return null;
    }

    const avatarSrc = profile.avatarUrl ? `${API_URL}${profile.avatarUrl}` : DEFAULT_AVATAR;
    const bannerSrc = profile.bannerUrl ? `${API_URL}${profile.bannerUrl}` : null;

    return (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center" onClick={onClose}>
            <div className="bg-[#232428] rounded-xl w-[360px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Banner */}
                <div className={`h-[100px] ${bannerSrc ? "" : "bg-[#5865F2]"}`}>
                    {bannerSrc && (
                        <img src={bannerSrc} className="w-full h-full object-cover" alt="" />
                    )}
                </div>

                {/* Avatar overlapping banner */}
                <div className="px-4 -mt-10">
                    <img
                        src={avatarSrc}
                        className="w-20 h-20 rounded-full object-cover border-4 border-[#232428]"
                        alt=""
                    />
                </div>

                {/* Info */}
                <div className="px-4 pt-2 pb-4">
                    <h2 className="text-xl font-bold text-white">{profile.displayName}</h2>
                    <p className="text-sm text-[#949ba4]">@{profile.username}</p>

                    {profile.bio && (
                        <div className="mt-3 bg-[#2b2d31] rounded-lg px-3 py-2">
                            <p className="text-xs font-semibold text-[#b5bac1] uppercase mb-1">About Me</p>
                            <p className="text-sm text-[#dbdee1] whitespace-pre-wrap break-words">{profile.bio}</p>
                        </div>
                    )}

                    <div className="mt-3 flex items-center gap-3 text-xs text-[#949ba4]">
                        <span>Member since {new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
                        {!profile.isSelf && profile.mutualFriendCount != null && profile.mutualFriendCount > 0 && (
                            <span className="text-[#5865F2]">{profile.mutualFriendCount} mutual friend{profile.mutualFriendCount > 1 ? "s" : ""}</span>
                        )}
                    </div>

                    {/* Mutual friends — expandable */}
                    {!profile.isSelf && profile.mutualFriendCount != null && profile.mutualFriendCount > 0 && (
                        <div className="mt-2">
                            <button
                                onClick={async () => {
                                    if (!showFriends && !friends) {
                                        setFriends(await userProfiles.getFriends(userId));
                                    }
                                    setShowFriends(!showFriends);
                                }}
                                className="text-xs text-[#5865F2] hover:underline"
                            >
                                {showFriends ? "Hide mutual friends" : `Show ${profile.mutualFriendCount} mutual friend${profile.mutualFriendCount > 1 ? "s" : ""}`}
                            </button>
                            {showFriends && friends && (
                                <div className="mt-2 max-h-[120px] overflow-y-auto space-y-1">
                                    {friends.map(f => (
                                        <div
                                            key={f.id}
                                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer"
                                            onClick={() => window.dispatchEvent(new CustomEvent("user:profile:open", { detail: { userId: f.id } }))}
                                        >
                                            <img src={f.avatarUrl ? `${API_URL}${f.avatarUrl}` : DEFAULT_AVATAR} className="w-6 h-6 rounded-full object-cover" alt="" />
                                            <span className="text-xs text-[#dbdee1] truncate">{f.displayName}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    {!profile.isSelf && (
                        <div className="flex gap-2 mt-4">
                            {isBlocked ? (
                                <button
                                    onClick={async () => {
                                        if (await unblockUser(profile.id)) {
                                            setIsBlocked(false);
                                            toast(`${profile.displayName} unblocked.`, "success");
                                        }
                                    }}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#248046] text-white hover:bg-[#1a6334] transition-colors"
                                >
                                    Unblock
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={async () => {
                                            const chId = await startDm(profile.id, "");
                                            if (chId) { navigate(`/app/dm/${chId}`); onClose(); }
                                            else toast("Can't message this user.", "error");
                                        }}
                                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#5865F2] text-white hover:bg-[#4752c4] transition-colors"
                                    >
                                        Message
                                    </button>

                                    <button
                                        onClick={async () => {
                                            const chId = await startDm(profile.id, "");
                                            if (!chId) { toast("Can't call this user.", "error"); return; }
                                            await startDmCall(chId);
                                            navigate(`/app/dm/${chId}`);
                                            onClose();
                                        }}
                                        disabled={voiceState.isConnected}
                                        className="px-3 py-2 rounded-lg text-sm bg-[#2b2d31] text-[#248046] hover:bg-[#248046] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-default"
                                        title={voiceState.isConnected ? "Already in a call" : "Start call"}
                                    >
                                        <PhoneIcon size={16} />
                                    </button>

                                    {profile.isFriend ? (
                                        <button
                                            onClick={() => setConfirmAction("unfriend")}
                                            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2b2d31] text-[#f23f43] hover:bg-[#da373c] hover:text-white transition-colors"
                                        >
                                            Unfriend
                                        </button>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                await sendFriendRequest(profile.username);
                                                toast("Friend request sent!", "success");
                                            }}
                                            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2b2d31] text-[#248046] hover:bg-[#248046] hover:text-white transition-colors"
                                        >
                                            Add Friend
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setConfirmAction("block")}
                                        className="px-3 py-2 rounded-lg text-sm bg-[#2b2d31] text-[#949ba4] hover:text-[#f23f43] hover:bg-[#35373c] transition-colors"
                                        title="Block"
                                    >
                                        <BanIcon size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                open={confirmAction === "unfriend"}
                title={`Remove ${profile.displayName}`}
                description={`Are you sure you want to remove ${profile.displayName} as a friend?`}
                confirmLabel="Remove Friend"
                confirmVariant="danger"
                onConfirm={async () => {
                    await removeFriend(profile.id);
                    setProfile(p => p ? { ...p, isFriend: false } : p);
                    toast("Friend removed.", "info");
                    setConfirmAction(null);
                }}
                onCancel={() => setConfirmAction(null)}
            />

            <ConfirmModal
                open={confirmAction === "block"}
                title={`Block ${profile.displayName}`}
                description={`Are you sure you want to block ${profile.displayName}? ${profile.isFriend ? "This will also remove them as a friend. " : ""}They won't be able to message you.`}
                confirmLabel="Block"
                confirmVariant="danger"
                onConfirm={async () => {
                    if (await blockUser(profile.id)) {
                        setIsBlocked(true);
                        setProfile(p => p ? { ...p, isFriend: false } : p);
                        toast(`${profile.displayName} blocked.`, "info");
                    }
                    setConfirmAction(null);
                }}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
}
