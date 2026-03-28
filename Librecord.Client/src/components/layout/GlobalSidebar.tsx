import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useGuilds, type GuildSummary } from "../../hooks/useGuilds";
import { useChannels } from "../../hooks/useChannels";
import { useVoice } from "../../hooks/useVoice";
import CreateGuildModal from "../../pages/guild/CreateGuildModal";
import { JoinGuildModal } from "../../components/guild/JoinGuildModal";
import { StatusDot } from "../../components/user/StatusDot";
import { usePresence } from "../../hooks/usePresence";
import type { AppEventMap } from "../../realtime/events";
import { API_URL } from "../../api/client";

function SidebarIcon({
    children,
    active,
    unread,
    tooltip,
    className = "",
    onClick,
    to,
    testId,
}: {
    children: React.ReactNode;
    active?: boolean;
    unread?: boolean;
    tooltip?: string;
    className?: string;
    onClick?: () => void;
    to?: string;
    testId?: string;
}) {
    const inner = (
        <div className="relative group flex items-center" data-testid={testId}>
            <span
                className={`
                    absolute -left-3 w-1 rounded-r-full bg-white transition-all
                    ${active ? "h-10" : unread ? "h-2" : "h-0 group-hover:h-5"}
                `}
            />

            <div
                onClick={onClick}
                className={`
                    w-12 h-12 flex items-center justify-center relative
                    transition-all duration-200 cursor-pointer
                    ${active ? "rounded-2xl" : "rounded-full hover:rounded-2xl"}
                    ${className}
                `}
            >
                {children}
                {unread && !active && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#f23f43] rounded-full border-2 border-[#1e1f22]" />
                )}
            </div>

            {tooltip && (
                <div className="fixed left-[80px] px-3 py-1.5 bg-[#111214] text-white text-sm font-medium rounded-md shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {tooltip}
                </div>
            )}
        </div>
    );

    if (to) return <Link to={to}>{inner}</Link>;
    return inner;
}

export default function GlobalSidebar() {
    const { user } = useAuth();
    const { getGuilds, createGuild } = useGuilds();
    const navigate = useNavigate();
    const { guildId } = useParams();

    const location = useLocation();
    const { getGuildChannels } = useChannels();

    const [guilds, setGuilds] = useState<GuildSummary[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [removedNotice, setRemovedNotice] = useState<{ action: "kick" | "ban"; reason?: string | null } | null>(null);
    const { myStatus } = usePresence();
    const { voiceState, leaveVoice } = useVoice();

    const [guildUnreads, setGuildUnreads] = useState<Record<string, number>>({});
    const [dmUnread, setDmUnread] = useState(false);
    const channelToGuildRef = useRef<Record<string, string>>({});

    const isDmPage = !guildId && location.pathname.startsWith("/app/dm");

    if (isDmPage && dmUnread) {
        setDmUnread(false);
    }

    const loadGuilds = useCallback(() => {
        getGuilds().then(async (list) => {
            setGuilds(list);
            const map: Record<string, string> = {};
            for (const g of list) {
                const channels = await getGuildChannels(g.id);
                for (const ch of channels) map[ch.id] = g.id;
            }
            channelToGuildRef.current = map;
        }).catch(() => {});
    }, [getGuilds, getGuildChannels]);

    useEffect(() => { loadGuilds(); }, [loadGuilds]);

    useEffect(() => {
        const refresh = () => { loadGuilds(); };
        window.addEventListener("realtime:reconnected", refresh);
        return () => window.removeEventListener("realtime:reconnected", refresh);
    }, [loadGuilds]);

    useEffect(() => {
        const onGuildUpdated = (e: CustomEvent<AppEventMap["guild:updated"]>) => {
            const { guildId: id, name, iconUrl } = e.detail;
            setGuilds(prev => prev.map(g =>
                g.id === id
                    ? { ...g, ...(name !== undefined && { name }), ...(iconUrl !== undefined && { iconUrl: `${iconUrl}?t=${Date.now()}` }) }
                    : g
            ));
        };
        window.addEventListener("guild:updated", onGuildUpdated as EventListener);
        return () => window.removeEventListener("guild:updated", onGuildUpdated as EventListener);
    }, []);

    useEffect(() => {
        const onGuildDeleted = (e: CustomEvent<AppEventMap["guild:deleted"]>) => {
            const deletedId = e.detail.guildId;
            setGuilds(prev => prev.filter(g => g.id !== deletedId));
            setGuildUnreads(prev => {
                const next = { ...prev };
                delete next[deletedId];
                return next;
            });
            if (guildId === deletedId) {
                navigate("/app/dm");
            }
        };

        window.addEventListener("guild:deleted", onGuildDeleted as EventListener);
        return () => window.removeEventListener("guild:deleted", onGuildDeleted as EventListener);
    }, [guildId, navigate]);

    useEffect(() => {
        const onMemberRemoved = (e: CustomEvent<AppEventMap["guild:member:removed"]>) => {
            if (e.detail.userId !== user?.userId) return; // not us
            const removedGuildId = e.detail.guildId;

            // Remove guild from sidebar
            setGuilds(prev => prev.filter(g => g.id !== removedGuildId));

            // Disconnect voice if in this guild
            if (voiceState.isConnected && voiceState.guildId === removedGuildId) {
                leaveVoice();
            }

            // Navigate away if viewing this guild
            if (guildId === removedGuildId) {
                navigate("/app/dm");
            }

            // Show notice for kick/ban (not leave — that's voluntary)
            if (e.detail.action !== "leave") {
                setRemovedNotice({ action: e.detail.action, reason: e.detail.reason });
            }
        };

        window.addEventListener("guild:member:removed", onMemberRemoved as EventListener);
        return () => window.removeEventListener("guild:member:removed", onMemberRemoved as EventListener);
    }, [user?.userId, guildId, voiceState.isConnected, voiceState.guildId, leaveVoice, navigate]);

    useEffect(() => {
        const onGuildPing = (e: CustomEvent<AppEventMap["guild:message:ping"]>) => {
            const { channelId: pingCh, authorId } = e.detail;
            if (authorId === user?.userId) return;
            const pingGuildId = channelToGuildRef.current[pingCh];
            if (!pingGuildId) return;
            if (guildId === pingGuildId) return;
            setGuildUnreads(prev => ({ ...prev, [pingGuildId]: (prev[pingGuildId] ?? 0) + 1 }));
        };
        window.addEventListener("guild:message:ping", onGuildPing as EventListener);
        return () => window.removeEventListener("guild:message:ping", onGuildPing as EventListener);
    }, [guildId, user?.userId]);

    useEffect(() => {
        const onDmPing = (e: CustomEvent<AppEventMap["dm:message:ping"]>) => {
            if (e.detail.authorId === user?.userId) return;
            if (isDmPage) return;
            setDmUnread(true);
        };
        window.addEventListener("dm:message:ping", onDmPing as EventListener);
        return () => window.removeEventListener("dm:message:ping", onDmPing as EventListener);
    }, [isDmPage, user?.userId]);

    const effectiveGuildUnreads = guildId
        ? Object.fromEntries(Object.entries(guildUnreads).filter(([k]) => k !== guildId))
        : guildUnreads;

    const effectiveDmUnread = isDmPage ? false : dmUnread;

    const avatarSrc =
        user?.avatarUrl
            ? `${API_URL}${user.avatarUrl}`
            : "/default-avatar.png";

    async function handleCreateGuild(name: string) {
        const guild = await createGuild(name);
        if (!guild) return;

        setGuilds(prev => [...prev, guild]);
        setShowCreate(false);
        navigate(`/app/guild/${guild.id}`);
    }

    return (
        <>
            <aside id="global-sidebar" className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 gap-2 overflow-y-auto no-scrollbar">

                <SidebarIcon to="/app/dm" active={isDmPage} unread={effectiveDmUnread} tooltip="Direct Messages" className="bg-[#313338] hover:bg-[#5865F2] text-white">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </SidebarIcon>

                <div className="w-8 h-0.5 bg-[#35373c] rounded-full" />

                {guilds.map(g => (
                    <SidebarIcon
                        key={g.id}
                        to={`/app/guild/${g.id}`}
                        active={guildId === g.id}
                        unread={(effectiveGuildUnreads[g.id] ?? 0) > 0}
                        tooltip={g.name}
                        testId={`guild-icon-${g.id}`}
                        className="bg-[#313338] hover:bg-[#5865F2] text-white"
                    >
                        {g.iconUrl ? (
                            <img
                                src={`${API_URL}${g.iconUrl}`}
                                className="w-full h-full rounded-[inherit] object-cover"
                                alt=""
                            />
                        ) : (
                            <span className="text-lg font-medium">
                                {g.name[0].toUpperCase()}
                            </span>
                        )}
                    </SidebarIcon>
                ))}

                <SidebarIcon
                    onClick={() => setShowCreate(true)}
                    tooltip="Create a Guild"
                    testId="create-guild-btn"
                    className="bg-[#313338] hover:bg-[#248046] text-[#248046] hover:text-white"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </SidebarIcon>

                <SidebarIcon
                    onClick={() => setShowJoin(true)}
                    tooltip="Join a Guild"
                    testId="join-guild-btn"
                    className="bg-[#313338] hover:bg-[#5865F2] text-[#248046] hover:text-white"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                </SidebarIcon>

                <div className="flex-1" />

                <Link to="/app/settings/user/profile">
                    <div className="relative group flex items-center">
                        <img
                            src={avatarSrc}
                            alt="Settings"
                            className="w-12 h-12 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5">
                            <StatusDot status={myStatus} size="md" />
                        </span>
                        <div className="absolute left-[60px] px-3 py-1.5 bg-[#111214] text-white text-sm font-medium rounded-md shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                            User Settings
                        </div>
                    </div>
                </Link>
            </aside>

            <CreateGuildModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreate={handleCreateGuild}
            />

            {showJoin && (
                <JoinGuildModal
                    onClose={() => setShowJoin(false)}
                    onJoined={(guild) => {
                        setGuilds(prev => [...prev, guild as GuildSummary]);
                        navigate(`/app/guild/${guild.id}`);
                    }}
                />
            )}

            {removedNotice && (
                <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center" onClick={() => setRemovedNotice(null)}>
                    <div className="bg-[#313338] rounded-lg p-6 w-full max-w-sm shadow-xl text-center" onClick={e => e.stopPropagation()}>
                        <div className="text-4xl mb-3">{removedNotice.action === "ban" ? "🔨" : "👋"}</div>
                        <h2 className="text-lg font-bold text-white mb-2">
                            {removedNotice.action === "ban" ? "You have been banned" : "You have been kicked"}
                        </h2>
                        <p className="text-sm text-[#b5bac1] mb-1">
                            {removedNotice.action === "ban"
                                ? "You have been banned from this guild and cannot rejoin unless unbanned."
                                : "You have been kicked from this guild. You can rejoin with a new invite."}
                        </p>
                        {removedNotice.action === "ban" && removedNotice.reason && (
                            <div className="mt-3 bg-[#2b2d31] rounded px-3 py-2 text-sm text-[#dbdee1]">
                                <span className="text-[#949ba4]">Reason: </span>{removedNotice.reason}
                            </div>
                        )}
                        <button
                            onClick={() => setRemovedNotice(null)}
                            className="mt-4 px-6 py-2 rounded bg-[#5865F2] text-white text-sm font-medium hover:bg-[#4752c4]"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
