import { Link, useParams, useLocation } from "react-router-dom";
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

const API_URL = import.meta.env.VITE_API_URL;

export default function DmSidebar() {
    const { dmId } = useParams();
    const location = useLocation();
    const { getMyDms } = useDirectMessagesChannel();
    const auth = useAuth();
    const { user } = auth;
    const { getAvatarUrl } = useUserProfile();
    const { getUnreadCounts } = useReadState();

    const [dms, setDms] = useState<DmChannel[]>([]);
    const [unreads, setUnreads] = useState<Record<string, number>>({});
    const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});

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

    // Increment unread when a new message arrives for a non-active channel
    useEffect(() => {
        const onNewMessage = (e: CustomEvent<DmEventMap["dm:message:new"]>) => {
            const { message } = e.detail;
            if (message.channelId === dmId) return;
            if (message.author.id === user?.userId) return;

            setUnreads(prev => ({
                ...prev,
                [message.channelId]: (prev[message.channelId] ?? 0) + 1,
            }));
        };

        window.addEventListener("dm:message:new", onNewMessage as EventListener);
        return () => window.removeEventListener("dm:message:new", onNewMessage as EventListener);
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
        <aside className="w-60 bg-[#2b2d31] p-2 border-r border-black/20 flex-1">
            <h2 className="text-[#949ba4] uppercase text-[11px] font-bold tracking-wide px-2 mb-2">
                Direct Messages
            </h2>

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
                        <Link key={dm.id} to={`/app/dm/${dm.id}`}>
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
                    );
                })}
            </div>
        </aside>
    );
}
