import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useDirectMessagesChannel } from "@librecord/app";
import type { DmChannel } from "@librecord/domain";
import { useAuth } from "@librecord/app";
import { useUserProfile } from "@librecord/app";
import { useUnreadContext } from "@librecord/app";
import { UnreadBadge } from "../ui/UnreadBadge";
import { StatusDot } from "../user/StatusDot";
import { presence } from "@librecord/api-client";
import { onCustomEvent, onEvent } from "@librecord/app";
import type { AppEventMap } from "@librecord/domain";
import { CreateGroupModal } from "../dm/CreateGroupModal";
import { CloseIcon, PersonsIcon, PhoneIcon } from "../ui/Icons";

export default function DmSidebar() {
    const { dmId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { getMyDms, leaveChannel, deleteDm } = useDirectMessagesChannel();
    const { user } = useAuth();
    const { getAvatarUrl } = useUserProfile();
    const { counts, fetchUnreads, clearChannel, setActiveChannel } = useUnreadContext();

    const [dms, setDms] = useState<DmChannel[]>([]);
    const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [leaveConfirmId, setLeaveConfirmId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [activeCalls, setActiveCalls] = useState<Record<string, number>>({});

    const isFriendsPage = location.pathname.startsWith("/app/dm/friends");

    // Clear unreads for active DM channel
    useEffect(() => {
        if (dmId) {
            setActiveChannel(dmId);
            clearChannel(dmId);
        }
        return () => setActiveChannel(undefined);
    }, [dmId, setActiveChannel, clearChannel]);

    const loadDms = useCallback(async function loadDms() {
        const list = await getMyDms();
        setDms(list);

        if (list.length > 0) {
            await fetchUnreads(list.map(d => d.id));

            const otherUserIds = list.flatMap(dm =>
                dm.members.filter(m => m.id !== user?.userId).map(m => m.id)
            );
            const uniqueIds = [...new Set(otherUserIds)];

            if (uniqueIds.length > 0) {
                const map = await presence.bulk(uniqueIds);
                setPresenceMap(map);
            }
        }
    }, [getMyDms, fetchUnreads, user?.userId]);

    useEffect(() => {
        Promise.resolve().then(loadDms);
    }, [loadDms]);

    useEffect(() => {
        const refresh = () => { loadDms(); };
        const cleanups = [
            onEvent("friend:removed", refresh),
            onEvent("dm:channel:created", refresh),
            onEvent("dm:member:added", refresh),
            onEvent("realtime:reconnected", refresh),
        ];
        return () => cleanups.forEach(fn => fn());
    }, [loadDms]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:member:left"]>("dm:member:left", (detail) => {
            const { channelId, userId } = detail;
            if (userId === user?.userId) {
                setDms(prev => prev.filter(d => d.id !== channelId));
                if (dmId === channelId) navigate("/app/dm");
            } else {
                setDms(prev => prev.map(d =>
                    d.id === channelId
                        ? { ...d, members: d.members.filter(m => m.id !== userId) }
                        : d
                ));
            }
        });
    }, [dmId, user?.userId, navigate]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:channel:deleted"]>("dm:channel:deleted", (detail) => {
            const { channelId } = detail;
            setDms(prev => prev.filter(d => d.id !== channelId));
            if (dmId === channelId) navigate("/app/dm");
        });
    }, [dmId, navigate]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:user:presence"]>("dm:user:presence", (detail) => {
            setPresenceMap(prev => ({
                ...prev,
                [detail.userId]: detail.status,
            }));
        });
    }, []);

    // Track active DM voice calls
    const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";
    useEffect(() => {
        const cleanups = [
            onCustomEvent<AppEventMap["voice:user:joined"]>("voice:user:joined", (detail) => {
                if (detail.guildId !== EMPTY_GUID) return;
                setActiveCalls(prev => ({ ...prev, [detail.channelId]: (prev[detail.channelId] ?? 0) + 1 }));
            }),
            onCustomEvent<AppEventMap["voice:user:left"]>("voice:user:left", (detail) => {
                if (detail.guildId !== EMPTY_GUID) return;
                setActiveCalls(prev => {
                    const count = (prev[detail.channelId] ?? 1) - 1;
                    if (count <= 0) {
                        const next = { ...prev };
                        delete next[detail.channelId];
                        return next;
                    }
                    return { ...prev, [detail.channelId]: count };
                });
            }),
        ];
        return () => cleanups.forEach(fn => fn());
    }, []);

    // Reload DM list when a ping arrives for an unknown channel
    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:message:ping"]>("dm:message:ping", (detail) => {
            const { channelId: pingChannel } = detail;
            setDms(prev => {
                const exists = prev.some(d => d.id === pingChannel);
                if (!exists) loadDms();
                return prev;
            });
        });
    }, [loadDms]);

    return (
        <>
        <aside aria-label="Direct messages" data-testid="dm-sidebar" role="navigation" className="w-60 shrink-0 bg-[#2b2d31] p-2 border-r border-black/20 flex-1">
            <div className="flex items-center justify-between px-2 mb-2">
                <h2 className="text-[#949ba4] uppercase text-xs font-bold tracking-wide">
                    Direct Messages
                </h2>
                <button
                    onClick={() => setShowCreateGroup(true)}
                    className="text-[#949ba4] hover:text-[#dbdee1] text-base leading-none"
                    title="Create Group DM"
                    aria-label="Create Group DM"
                    data-testid="create-group-dm-btn"
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
                    <PersonsIcon size={20} className="shrink-0" />
                    Friends
                </div>
            </Link>

            <div className="space-y-0.5 mt-1" role="list" aria-label="Conversations">
                {dms.map(dm => {
                    const others = dm.members.filter(m => m.id !== user?.userId);
                    const name = dm.isGroup
                        ? (dm.name ?? "Unnamed Group")
                        : (others.length > 0 ? others.map(u => u.displayName).join(", ") : "Empty Group");

                    const showAvatar = others.length === 1;
                    const avatar = showAvatar ? getAvatarUrl(others[0].avatarUrl) : undefined;
                    const unreadCount = counts[dm.id] ?? 0;
                    const otherStatus = showAvatar ? (presenceMap[others[0].id] ?? "offline") : undefined;

                    return (
                        <div key={dm.id} className="group relative" data-testid={`dm-item-${dm.id}`}>
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

                                    {activeCalls[dm.id] && (
                                        <PhoneIcon size={14} className="text-green-400 shrink-0" />
                                    )}
                                    {unreadCount > 0 && dmId !== dm.id && (
                                        <UnreadBadge count={unreadCount} />
                                    )}
                                </div>
                            </Link>
                            {dm.isGroup && <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setLeaveConfirmId(dm.id);
                                }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#949ba4] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Leave group"
                                aria-label="Leave group"
                            >
                                <CloseIcon size={14} />
                            </button>}
                            {!dm.isGroup && dm.isFriend === false && <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteConfirmId(dm.id);
                                }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#949ba4] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete conversation"
                                aria-label="Delete conversation"
                            >
                                <CloseIcon size={14} />
                            </button>}
                        </div>
                    );
                })}
            </div>
        </aside>

        {leaveConfirmId && (() => {
            const leaveDm = dms.find(d => d.id === leaveConfirmId);
            const isLast = leaveDm && leaveDm.members.length <= 1;
            return (
            <div className="modal-overlay" onClick={() => setLeaveConfirmId(null)}>
                <div role="dialog" aria-modal="true" aria-label="Leave Group" className="bg-[#313338] rounded-lg w-full max-w-md mx-4 p-5" onClick={e => e.stopPropagation()}>
                    <h3 className="text-white text-lg font-semibold mb-2">Leave Group</h3>
                    <p className="text-[#949ba4] text-sm mb-5">
                        {isLast
                            ? "You are the last member. Leaving will permanently delete this group and all its messages and attachments."
                            : "Are you sure you want to leave this group? You won't be able to rejoin unless someone adds you back."}
                    </p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setLeaveConfirmId(null)} className="btn-text">
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
                            className="btn-danger"
                        >
                            Leave Group
                        </button>
                    </div>
                </div>
            </div>
            );
        })()}

        {deleteConfirmId && (
            <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
                <div role="dialog" aria-modal="true" aria-label="Delete Conversation" className="bg-[#313338] rounded-lg w-full max-w-md mx-4 p-5" onClick={e => e.stopPropagation()}>
                    <h3 className="text-white text-lg font-semibold mb-2">Delete Conversation</h3>
                    <p className="text-[#949ba4] text-sm mb-5">
                        Are you sure you want to delete this conversation? All messages and attachments will be permanently removed for both users.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setDeleteConfirmId(null)} className="btn-text">
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                if (await deleteDm(deleteConfirmId)) {
                                    setDms(prev => prev.filter(d => d.id !== deleteConfirmId));
                                    if (dmId === deleteConfirmId) navigate("/app/dm");
                                }
                                setDeleteConfirmId(null);
                            }}
                            className="btn-danger"
                            data-testid="confirm-delete-dm"
                        >
                            Delete Conversation
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showCreateGroup && (
            <CreateGroupModal
                onClose={() => setShowCreateGroup(false)}
                onCreated={(channelId) => {
                    setShowCreateGroup(false);
                    navigate(`/app/dm/${channelId}`);
                    getMyDms().then(setDms);
                }}
            />
        )}
        </>
    );
}
