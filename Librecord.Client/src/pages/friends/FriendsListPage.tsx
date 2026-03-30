import { useCallback, useEffect, useState } from "react";
import {
    useFriends,
    type FriendshipListDto
} from "../../hooks/useFriends";
import { useBlocks } from "../../hooks/useBlocks";
import type { BlockedUser } from "../../types/block";

import RemoveFriendModal from "../../pages/friends/RemoveFriendModal";
import { useNavigate } from "react-router-dom";
import { useDirectMessagesChannel } from "../../hooks/useDirectMessagesChannel";
import { useToast } from "../../hooks/useToast";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { onEvent } from "../../lib/typedEvent";
import { API_URL } from "../../api/client";

export default function FriendsListPage() {
    const {
        getFriends,
        getRequests,
        acceptRequest,
        declineRequest,
        cancelRequest,
        removeFriend
    } = useFriends();

    const [friends, setFriends] = useState<FriendshipListDto[]>([]);
    const [incoming, setIncoming] = useState<FriendshipListDto[]>([]);
    const [outgoing, setOutgoing] = useState<FriendshipListDto[]>([]);
    const [dataLoaded, setDataLoaded] = useState(false);
    const loading = !dataLoaded;

    const navigate = useNavigate();
    const { startDm } = useDirectMessagesChannel();
    const { toast } = useToast();

    const { blockUser, unblockUser, getBlockedUsers } = useBlocks();

    const [removeTarget, setRemoveTarget] =
        useState<FriendshipListDto | null>(null);
    const [blockTarget, setBlockTarget] = useState<{ userId: string; name: string } | null>(null);
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [blocksLoaded, setBlocksLoaded] = useState(false);

    const loadData = useCallback(async function loadData() {
        try {
            const friendsList = await getFriends();
            const requestData = await getRequests();

            setFriends(friendsList ?? []);
            setIncoming(requestData?.incoming ?? []);
            setOutgoing(requestData?.outgoing ?? []);
        } catch {
            // Show whatever we have — empty lists are fine
        } finally {
            setDataLoaded(true);
        }
    }, [getFriends, getRequests]);

    useEffect(() => {
        Promise.resolve().then(loadData);
    }, [loadData]);

    useEffect(() => {
        const refresh = () => { loadData(); };
        const cleanups = [
            onEvent("friend:request:received", refresh),
            onEvent("friend:request:accepted", refresh),
            onEvent("friend:request:declined", refresh),
            onEvent("friend:removed", refresh),
        ];
        return () => cleanups.forEach(fn => fn());
    }, [loadData]);

    function avatar(url: string | null) {
        return url ? `${API_URL}${url}` : "/default-avatar.png";
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Spinner className="text-[#949ba4]" />
            </div>
        );
    }

    return (
        <div className="text-gray-200 space-y-8 pb-10">
            <h1 className="text-2xl font-bold text-white">Friends</h1>

            {incoming.length > 0 && (
                <section>
                    <h2 className="text-xs font-bold uppercase text-[#949ba4] tracking-wide mb-3">
                        Pending — {incoming.length}
                    </h2>

                    <div className="space-y-0.5">
                        {incoming.map(req => (
                            <div
                                key={req.id}
                                className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-[#35373c] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <img
                                        src={avatar(req.otherAvatarUrl)}
                                        className="w-9 h-9 rounded-full object-cover"
                                        alt=""
                                    />
                                    <div>
                                        <span className="text-white font-medium text-sm">
                                            {req.otherDisplayName}
                                        </span>
                                        <div className="text-xs text-[#949ba4]">
                                            Incoming Friend Request
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            await acceptRequest(req.otherUserId);
                                            toast(`You are now friends with ${req.otherDisplayName}!`, "success");
                                            loadData();
                                        }}
                                        className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#248046] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors"
                                        title="Accept"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </button>

                                    <button
                                        onClick={async () => {
                                            await declineRequest(req.otherUserId);
                                            toast("Friend request declined.", "info");
                                            loadData();
                                        }}
                                        className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#da373c] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors"
                                        title="Decline"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <h2 className="text-xs font-bold uppercase text-[#949ba4] tracking-wide mb-3">
                    All Friends — {friends.length}
                </h2>

                {friends.length === 0 && (
                    <EmptyState
                        icon="👋"
                        title="No friends yet"
                        description="Add friends to start chatting! Use the Add Friend tab above."
                    />
                )}

                <div className="space-y-0.5">
                    {friends.map(f => (
                        <div
                            key={f.otherUserId}
                            className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-[#35373c] group transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <img
                                    src={avatar(f.otherAvatarUrl)}
                                    className="w-9 h-9 rounded-full object-cover"
                                    alt=""
                                />
                                <div>
                                    <span className="text-white font-medium text-sm">
                                        {f.otherDisplayName}
                                    </span>
                                    <div className="text-xs text-[#949ba4]">
                                        @{f.otherUsername}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={async () => {
                                        const channelId = await startDm(f.otherUserId, "");
                                        if (channelId) {
                                            navigate(`/app/dm/${channelId}`);
                                        }
                                    }}
                                    className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#5865F2] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors"
                                    title="Message"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                </button>

                                <button
                                    onClick={() => setBlockTarget({ userId: f.otherUserId, name: f.otherDisplayName })}
                                    className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#da373c] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                    title="Block"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                    </svg>
                                </button>

                                <button
                                    onClick={() => setRemoveTarget(f)}
                                    className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#da373c] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remove friend"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {outgoing.length > 0 && (
                <section>
                    <h2 className="text-xs font-bold uppercase text-[#949ba4] tracking-wide mb-3">
                        Sent — {outgoing.length}
                    </h2>

                    <div className="space-y-0.5">
                        {outgoing.map(req => (
                            <div
                                key={req.id}
                                className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-[#35373c] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <img
                                        src={avatar(req.otherAvatarUrl)}
                                        className="w-9 h-9 rounded-full object-cover"
                                        alt=""
                                    />
                                    <div>
                                        <span className="text-white font-medium text-sm">
                                            {req.otherDisplayName}
                                        </span>
                                        <div className="text-xs text-[#949ba4]">
                                            Outgoing Friend Request
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        await cancelRequest(req.otherUserId);
                                        toast("Friend request cancelled.", "info");
                                        loadData();
                                    }}
                                    className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#da373c] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors"
                                    title="Cancel request"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Blocked users */}
            <section>
                <h2 className="text-xs font-bold uppercase text-[#949ba4] tracking-wide mb-3">
                    Blocked
                </h2>
                {!blocksLoaded ? (
                    <button
                        onClick={async () => {
                            setBlockedUsers(await getBlockedUsers());
                            setBlocksLoaded(true);
                        }}
                        className="text-sm text-[#949ba4] hover:text-white"
                    >
                        Show blocked users
                    </button>
                ) : blockedUsers.length === 0 ? (
                    <p className="text-sm text-[#949ba4]">No blocked users.</p>
                ) : (
                    <div className="space-y-0.5">
                        {blockedUsers.map(b => (
                            <div key={b.userId} className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-[#35373c] transition-colors">
                                <div>
                                    <span className="text-white font-medium text-sm">{b.displayName}</span>
                                    <span className="text-xs text-[#949ba4] ml-2">@{b.username}</span>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (await unblockUser(b.userId)) {
                                            setBlockedUsers(prev => prev.filter(u => u.userId !== b.userId));
                                            toast(`${b.displayName} unblocked.`, "success");
                                        }
                                    }}
                                    className="px-3 py-1 rounded text-sm font-medium bg-[#248046] hover:bg-[#1a6334] text-white transition-colors"
                                >
                                    Unblock
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <RemoveFriendModal
                open={!!removeTarget}
                username={removeTarget?.otherDisplayName ?? ""}
                onClose={() => setRemoveTarget(null)}
                onConfirm={async () => {
                    if (!removeTarget) return;
                    await removeFriend(removeTarget.otherUserId);
                    setRemoveTarget(null);
                    toast("Friend removed.", "info");
                    loadData();
                }}
            />

            <ConfirmModal
                open={!!blockTarget}
                title={`Block ${blockTarget?.name ?? ""}`}
                description="Blocking will also remove them as a friend. They won't be able to message you or send friend requests."
                confirmLabel="Block"
                confirmVariant="danger"
                onConfirm={async () => {
                    if (!blockTarget) return;
                    if (await blockUser(blockTarget.userId)) {
                        toast(`${blockTarget.name} blocked.`, "info");
                        loadData();
                        setBlockedUsers(await getBlockedUsers());
                        setBlocksLoaded(true);
                    }
                    setBlockTarget(null);
                }}
                onCancel={() => setBlockTarget(null)}
            />
        </div>
    );
}
