import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
    useDirectMessagesChannel,
    type DmChannel
} from "../../hooks/useDirectMessagesChannel";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useReadState } from "../../hooks/useReadState";
import { UnreadBadge } from "../ui/UnreadBadge";
import { StatusDot } from "../user/StatusDot";
import { fetchWithAuth } from "../../api/fetchWithAuth";
import type { DmEventMap } from "../../realtime/dm/dmEvents";
import { CreateGroupModal } from "../dm/CreateGroupModal";

const API_URL = import.meta.env.VITE_API_URL;

export default function DmSidebar() {
    const { dmId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { getMyDms, leaveChannel } = useDirectMessagesChannel();
    const auth = useAuth();
    const { user } = auth;
    const { getAvatarUrl } = useUserProfile();
    const { getUnreadCounts } = useReadState();

    const [dms, setDms] = useState<DmChannel[]>([]);
    const [unreads, setUnreads] = useState<Record<string, number>>({});
    const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [leaveConfirmId, setLeaveConfirmId] = useState<string | null>(null);

    const isFriendsPage = location.pathname.startsWith("/app/dm/friends");

    async function loadDms() {
        const list = await getMyDms();
        setDms(list);

        if (list.length > 0) {
            const counts = await getUnreadCounts(list.map(d => d.id));
            setUnreads(counts);

            // Fetch presence for all DM contacts
            const otherUserIds = list.flatMap(dm =>
                dm.members.filter(m => m.id !== user?.userId).map(m => m.id)
            );
            const uniqueIds = [...new Set(otherUserIds)];

            if (uniqueIds.length > 0) {
                const res = await fetchWithAuth(
                    `${API_URL}/presence/bulk`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userIds: uniqueIds }),
                    },
                    auth
                );
                if (res.ok) {
                    setPresenceMap(await res.json());
                }
            }
        }
    }

    useEffect(() => {
        loadDms();
    }, []);

    // Update presence from real-time events
    useEffect(() => {
        const onPresence = (e: CustomEvent<DmEventMap["dm:user:presence"]>) => {
            setPresenceMap(prev => ({
                ...prev,
                [e.detail.userId]: e.detail.status,
            }));
        };

        window.addEventListener("dm:user:presence", onPresence as EventListener);
        return () => window.removeEventListener("dm:user:presence", onPresence as EventListener);
    }, []);

    // Increment unread when a message ping arrives for a non-active channel
    useEffect(() => {
        const onPing = (e: CustomEvent<DmEventMap["dm:message:ping"]>) => {
            const { channelId: pingChannel, authorId } = e.detail;
            if (pingChannel === dmId) return;
            if (authorId === user?.userId) return;

            setUnreads(prev => ({
                ...prev,
                [pingChannel]: (prev[pingChannel] ?? 0) + 1,
            }));
        };

        window.addEventListener("dm:message:ping", onPing as EventListener);
        return () => window.removeEventListener("dm:message:ping", onPing as EventListener);
    }, [dmId, user?.userId]);

    // Clear unread when we navigate into a channel
    useEffect(() => {
        if (!dmId) return;
        setUnreads(prev => {
            if (!prev[dmId]) return prev;
            const next = { ...prev };
            delete next[dmId];
            return next;
        });
    }, [dmId]);

    return (
        <>
        <aside className="w-60 bg-[#2b2d31] p-2 border-r border-black/20 flex-1">
            <div className="flex items-center justify-between px-2 mb-2">
                <h2 className="text-[#949ba4] uppercase text-[11px] font-bold tracking-wide">
                    Direct Messages
                </h2>
                <button
                    onClick={() => setShowCreateGroup(true)}
                    className="text-[#949ba4] hover:text-[#dbdee1] text-base leading-none"
                    title="Create Group DM"
                >
                    +
                </button>
            </div>

            <Link to="/app/dm/friends/list">
                <div
                    className={`
                        flex items-center gap-2.5 px-2.5 py-1.5 mb-1 rounded cursor-pointer transition-colors
                        hover:bg-[#35373c]
                        ${isFriendsPage ? "bg-[#404249] text-white" : "text-[#949ba4] hover:text-[#dbdee1]"}
                    `}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Friends
                </div>
            </Link>

            <div className="space-y-0.5 mt-1">
                {dms.map(dm => {
                    const others = dm.members.filter(m => m.id !== user?.userId);
                    const name = others.length > 0
                        ? others.map(u => u.displayName).join(", ")
                        : dm.id.slice(0, 8);

                    const showAvatar = others.length === 1;
                    const avatar = showAvatar ? getAvatarUrl(others[0].avatarUrl) : undefined;
                    const unreadCount = unreads[dm.id] ?? 0;
                    const otherStatus = showAvatar ? (presenceMap[others[0].id] ?? "offline") : undefined;

                    return (
                        <div key={dm.id} className="group relative">
                            <Link to={`/app/dm/${dm.id}`}>
                                <div
                                    className={`
                                        flex items-center gap-2.5 px-2.5 py-1.5 rounded cursor-pointer transition-colors
                                        hover:bg-[#35373c]
                                        ${dmId === dm.id ? "bg-[#404249] text-white" : "text-[#949ba4] hover:text-[#dbdee1]"}
                                        ${unreadCount > 0 && dmId !== dm.id ? "font-semibold text-white" : ""}
                                    `}
                                >
                                    {showAvatar && (
                                        <div className="relative shrink-0">
                                            <img
                                                src={avatar}
                                                className="w-8 h-8 rounded-full object-cover"
                                                alt=""
                                            />
                                            <span className="absolute -bottom-0.5 -right-0.5">
                                                <StatusDot status={otherStatus ?? "offline"} />
                                            </span>
                                        </div>
                                    )}

                                    <span className="truncate flex-1 text-sm">{name}</span>

                                    {unreadCount > 0 && dmId !== dm.id && (
                                        <UnreadBadge count={unreadCount} />
                                    )}
                                </div>
                            </Link>
                            {dm.isGroup && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setLeaveConfirmId(dm.id);
                                    }}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#949ba4] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Leave group"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>

        {leaveConfirmId && (() => {
            const leaveDm = dms.find(d => d.id === leaveConfirmId);
            const isLast = leaveDm && leaveDm.members.length <= 1;
            return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setLeaveConfirmId(null)}>
                <div className="bg-[#313338] rounded-lg w-[400px] p-5" onClick={e => e.stopPropagation()}>
                    <h3 className="text-white text-lg font-semibold mb-2">Leave Group</h3>
                    <p className="text-[#949ba4] text-sm mb-5">
                        {isLast
                            ? "You are the last member. Leaving will permanently delete this group and all its messages and attachments."
                            : "Are you sure you want to leave this group? You won't be able to rejoin unless someone adds you back."}
                    </p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setLeaveConfirmId(null)} className="px-4 py-2 text-sm text-[#dbdee1] hover:underline">
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                if (await leaveChannel(leaveConfirmId)) {
                                    setDms(prev => prev.filter(d => d.id !== leaveConfirmId));
                                    if (dmId === leaveConfirmId) navigate("/app/dm");
                                }
                                setLeaveConfirmId(null);
                            }}
                            className="px-4 py-2 text-sm bg-[#da373c] text-white rounded hover:bg-[#a12828] transition-colors"
                        >
                            Leave Group
                        </button>
                    </div>
                </div>
            </div>
            );
        })()}

        {showCreateGroup && (
            <CreateGroupModal
                onClose={() => setShowCreateGroup(false)}
                onCreated={(channelId) => {
                    setShowCreateGroup(false);
                    navigate(`/app/dm/${channelId}`);
                    // Refresh DM list
                    getMyDms().then(setDms);
                }}
            />
        )}
        </>
    );
}
