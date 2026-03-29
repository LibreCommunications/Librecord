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
import { useGuildSettings } from "../../hooks/useGuildSettings";
import { useToast } from "../../hooks/useToast";
import { ConfirmModal } from "../ui/ConfirmModal";
import { onCustomEvent, onEvent } from "../../lib/typedEvent";
import type { AppEventMap } from "../../realtime/events";
import { API_URL } from "../../api/client";
import { logger } from "../../lib/logger";
import { STORAGE } from "../../lib/storageKeys";
import { useGuildFolders } from "../../hooks/useGuildFolders";
import { FolderSettingsModal } from "./FolderSettingsModal";

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

    // ── Remember last visited paths ──────────────────────────
    function getLastVisited(): Record<string, string> {
        try { return JSON.parse(localStorage.getItem(STORAGE.lastVisited) ?? "{}"); } catch { return {}; }
    }

    const saveLastVisited = useCallback((key: string, path: string) => {
        const lv = getLastVisited();
        lv[key] = path;
        localStorage.setItem(STORAGE.lastVisited, JSON.stringify(lv));
    }, []);

    // Save current path on every navigation
    useEffect(() => {
        const path = location.pathname;
        if (path.startsWith("/app/dm/")) {
            saveLastVisited("dm", path);
        } else if (path.match(/^\/app\/guild\/[^/]+\/.+/)) {
            const gId = path.split("/")[3];
            saveLastVisited(`guild:${gId}`, path);
        }
    }, [location.pathname, saveLastVisited]);

    const [guilds, setGuilds] = useState<GuildSummary[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [removedNotice, setRemovedNotice] = useState<{ action: "kick" | "ban"; reason?: string | null } | null>(null);
    const [guildCtxMenu, setGuildCtxMenu] = useState<{ x: number; y: number; guild: GuildSummary } | null>(null);
    const [leaveGuildTarget, setLeaveGuildTarget] = useState<GuildSummary | null>(null);
    const { myStatus } = usePresence();
    const { voiceState, leaveVoice } = useVoice();
    const { leaveGuild } = useGuildSettings();
    const { toast } = useToast();

    // ── Guild Folders (client-only, localStorage) ────────────
    const {
        folders, expandedFolders, dragOverTarget, setDragOverTarget,
        renamingFolder, setRenamingFolder, renameValue, setRenameValue,
        renameColor, setRenameColor, toggleExpandFolder, saveFolders,
        createFolder, updateFolder, removeFromFolder, folderedGuildIds,
    } = useGuildFolders();

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
        }).catch(e => logger.api.warn("Failed to load guilds", e));
    }, [getGuilds, getGuildChannels]);

    useEffect(() => { loadGuilds(); }, [loadGuilds]);

    useEffect(() => {
        return onEvent("realtime:reconnected", () => { loadGuilds(); });
    }, [loadGuilds]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:updated"]>("guild:updated", (detail) => {
            const { guildId: id, name, iconUrl } = detail;
            setGuilds(prev => prev.map(g =>
                g.id === id
                    ? { ...g, ...(name !== undefined && { name }), ...(iconUrl !== undefined && { iconUrl: `${iconUrl}?t=${Date.now()}` }) }
                    : g
            ));
        });
    }, []);

    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:deleted"]>("guild:deleted", (detail) => {
            const deletedId = detail.guildId;
            setGuilds(prev => prev.filter(g => g.id !== deletedId));
            setGuildUnreads(prev => {
                const next = { ...prev };
                delete next[deletedId];
                return next;
            });
            if (guildId === deletedId) {
                navigate("/app/dm");
            }
        });
    }, [guildId, navigate]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:member:removed"]>("guild:member:removed", (detail) => {
            if (detail.userId !== user?.userId) return; // not us
            const removedGuildId = detail.guildId;

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

            // Show notice for kick/ban (not leave -- that's voluntary)
            if (detail.action !== "leave") {
                setRemovedNotice({ action: detail.action, reason: detail.reason });
            }
        });
    }, [user?.userId, guildId, voiceState.isConnected, voiceState.guildId, leaveVoice, navigate]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:message:ping"]>("guild:message:ping", (detail) => {
            const { channelId: pingCh, authorId } = detail;
            if (authorId === user?.userId) return;
            const pingGuildId = channelToGuildRef.current[pingCh];
            if (!pingGuildId) return;
            if (guildId === pingGuildId) return;
            setGuildUnreads(prev => ({ ...prev, [pingGuildId]: (prev[pingGuildId] ?? 0) + 1 }));
        });
    }, [guildId, user?.userId]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:message:ping"]>("dm:message:ping", (detail) => {
            if (detail.authorId === user?.userId) return;
            if (isDmPage) return;
            setDmUnread(true);
        });
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
            <aside
                id="global-sidebar"
                className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 gap-2 overflow-y-auto no-scrollbar"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                    const draggedId = e.dataTransfer.getData("guildId");
                    const fromFolder = e.dataTransfer.getData("fromFolder");
                    if (draggedId && fromFolder) {
                        e.preventDefault();
                        removeFromFolder(fromFolder, draggedId);
                    }
                }}
            >

                <SidebarIcon to={getLastVisited().dm || "/app/dm"} active={isDmPage} unread={effectiveDmUnread} tooltip="Direct Messages" className="bg-[#313338] hover:bg-[#5865F2] text-white">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </SidebarIcon>

                <div className="w-8 h-0.5 bg-[#35373c] rounded-full" />

                {/* Folders */}
                {folders.map(folder => {
                    const folderGuilds = folder.guildIds.map(id => guilds.find(g => g.id === id)).filter(Boolean) as GuildSummary[];
                    if (folderGuilds.length === 0) return null;
                    const isExpanded = expandedFolders.has(folder.id);
                    const folderColor = folder.color ?? "#5865F2";
                    const hasUnread = folderGuilds.some(g => (effectiveGuildUnreads[g.id] ?? 0) > 0);
                    const hasActive = folderGuilds.some(g => guildId === g.id);

                    return (
                        <div
                            key={folder.id}
                            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTarget(`folder:${folder.id}`); }}
                            onDragLeave={() => setDragOverTarget(null)}
                            onDrop={e => {
                                e.preventDefault();
                                setDragOverTarget(null);
                                const draggedId = e.dataTransfer.getData("guildId");
                                if (draggedId && !folder.guildIds.includes(draggedId)) {
                                    // Remove from any other folder first
                                    const cleaned = folders.map(f => ({ ...f, guildIds: f.guildIds.filter(id => id !== draggedId) }));
                                    saveFolders(cleaned.map(f => f.id === folder.id ? { ...f, guildIds: [...f.guildIds, draggedId] } : f).filter(f => f.guildIds.length >= 2));
                                }
                            }}
                        >
                            {isExpanded ? (
                                <>
                                    {/* Expanded: folder icon on top, guilds below */}
                                    <div className="rounded-[16px] p-1.5 flex flex-col items-center gap-1" style={{ backgroundColor: `${folderColor}20` }}>
                                        {/* Close folder icon on top */}
                                        <SidebarIcon
                                            onClick={() => toggleExpandFolder(folder.id)}
                                            tooltip={folder.name || "Close Folder"}
                                            className="!bg-transparent hover:brightness-125"
                                        >
                                            <div
                                                className="flex items-center justify-center"
                                                onContextMenu={e => { e.preventDefault(); setRenamingFolder(folder.id); setRenameValue(folder.name ?? ""); setRenameColor(folder.color ?? ""); }}
                                            >
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill={folderColor} stroke="none">
                                                    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
                                                </svg>
                                            </div>
                                        </SidebarIcon>
                                        {folderGuilds.map(g => (
                                            <div
                                                key={g.id}
                                                draggable
                                                onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData("guildId", g.id); e.dataTransfer.setData("fromFolder", folder.id); e.dataTransfer.effectAllowed = "move"; }}
                                                onContextMenu={e => { e.preventDefault(); setGuildCtxMenu({ x: e.clientX, y: e.clientY, guild: g }); }}
                                            >
                                                <SidebarIcon
                                                    to={getLastVisited()[`guild:${g.id}`] || `/app/guild/${g.id}`}
                                                    active={guildId === g.id}
                                                    unread={(effectiveGuildUnreads[g.id] ?? 0) > 0}
                                                    tooltip={g.name}
                                                    className="bg-[#313338] hover:bg-[#5865F2] text-white"
                                                >
                                                    {g.iconUrl ? (
                                                        <img src={`${API_URL}${g.iconUrl}`} className="w-full h-full rounded-[inherit] object-cover" alt="" />
                                                    ) : (
                                                        <span className="text-lg font-medium">{g.name[0].toUpperCase()}</span>
                                                    )}
                                                </SidebarIcon>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                /* Collapsed: folder pill with mini icons */
                                <div
                                    className={`relative group w-12 h-12 rounded-[16px] cursor-pointer hover:rounded-2xl transition-all flex items-center justify-center
                                        ${hasActive ? "rounded-2xl" : ""}
                                        ${dragOverTarget === `folder:${folder.id}` ? "ring-2 ring-[#5865F2]" : ""}`}
                                    style={{ backgroundColor: `${folderColor}20` }}
                                    onClick={() => toggleExpandFolder(folder.id)}
                                    onContextMenu={e => { e.preventDefault(); setRenamingFolder(folder.id); setRenameValue(folder.name ?? ""); setRenameColor(folder.color ?? ""); }}
                                >
                                    {/* Tooltip */}
                                    <div className="fixed left-[80px] px-3 py-1.5 bg-[#111214] text-white text-sm font-medium rounded-md shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                        {folder.name || `Folder — ${folderGuilds.length} guilds`}
                                    </div>
                                    <div className="grid grid-cols-2 gap-[3px] w-[34px] h-[34px]">
                                        {folderGuilds.slice(0, 4).map(g => (
                                            <div key={g.id} className="w-[15px] h-[15px] rounded-full overflow-hidden bg-[#313338]">
                                                {g.iconUrl ? (
                                                    <img src={`${API_URL}${g.iconUrl}`} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[7px] text-white font-bold">
                                                        {g.name[0]}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {hasUnread && !hasActive && (
                                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#f23f43] rounded-full border-2 border-[#1e1f22]" />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Unfoldered guilds */}
                {guilds.filter(g => !folderedGuildIds.has(g.id)).map(g => (
                    <div
                        key={g.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData("guildId", g.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTarget(`guild:${g.id}`); }}
                        onDragLeave={() => setDragOverTarget(null)}
                        onDrop={e => {
                            e.preventDefault();
                            setDragOverTarget(null);
                            const draggedId = e.dataTransfer.getData("guildId");
                            const fromFolder = e.dataTransfer.getData("fromFolder");
                            if (!draggedId || draggedId === g.id) return;
                            // Remove from source folder if any
                            if (fromFolder) removeFromFolder(fromFolder, draggedId);
                            // Create new folder with these two guilds
                            createFolder(g.id, draggedId);
                        }}
                        onContextMenu={e => { e.preventDefault(); setGuildCtxMenu({ x: e.clientX, y: e.clientY, guild: g }); }}
                    >
                        <SidebarIcon
                            to={getLastVisited()[`guild:${g.id}`] || `/app/guild/${g.id}`}
                            active={guildId === g.id}
                            unread={(effectiveGuildUnreads[g.id] ?? 0) > 0}
                            tooltip={g.name}
                            testId={`guild-icon-${g.id}`}
                            className={`bg-[#313338] hover:bg-[#5865F2] text-white ${dragOverTarget === `guild:${g.id}` ? "ring-2 ring-[#5865F2]" : ""}`}
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
                    </div>
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

            {/* Guild right-click menu */}
            {guildCtxMenu && (
                <>
                    <div className="fixed inset-0 z-[998]" onClick={() => setGuildCtxMenu(null)} />
                    <div
                        className="fixed z-[999] bg-[#111214] rounded-lg shadow-xl py-1 min-w-[160px] border border-[#2b2d31]"
                        style={{ top: guildCtxMenu.y, left: guildCtxMenu.x }}
                    >
                        {guildCtxMenu.guild.ownerId !== user?.userId && (
                            <button
                                onClick={() => {
                                    setLeaveGuildTarget(guildCtxMenu.guild);
                                    setGuildCtxMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-[#f23f43] hover:bg-[#da373c] hover:text-white"
                            >
                                Leave Guild
                            </button>
                        )}
                        {guildCtxMenu.guild.ownerId === user?.userId && (
                            <div className="px-3 py-2 text-sm text-[#949ba4]">No actions available</div>
                        )}
                    </div>
                </>
            )}

            <ConfirmModal
                open={!!leaveGuildTarget}
                title="Leave Guild"
                description={`Are you sure you want to leave ${leaveGuildTarget?.name ?? "this guild"}? You will need a new invite to rejoin.`}
                confirmLabel="Leave"
                confirmVariant="danger"
                onConfirm={async () => {
                    if (!leaveGuildTarget) return;
                    try {
                        const ok = await leaveGuild(leaveGuildTarget.id);
                        if (ok) {
                            setGuilds(prev => prev.filter(g => g.id !== leaveGuildTarget.id));
                            toast("Left the guild.", "info");
                            if (guildId === leaveGuildTarget.id) navigate("/app/dm");
                        } else {
                            toast("Cannot leave — guild owners must transfer ownership or delete the guild.", "error");
                        }
                    } catch {
                        toast("Cannot leave — guild owners must transfer ownership or delete the guild.", "error");
                    }
                    setLeaveGuildTarget(null);
                }}
                onCancel={() => setLeaveGuildTarget(null)}
            />

            <FolderSettingsModal
                folderId={renamingFolder}
                initialName={renameValue}
                initialColor={renameColor}
                onSave={(name, color) => { updateFolder(renamingFolder!, name, color); setRenamingFolder(null); }}
                onClose={() => setRenamingFolder(null)}
            />

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
