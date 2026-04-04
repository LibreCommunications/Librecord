import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@librecord/app";
import { useGuilds } from "@librecord/app";
import type { GuildSummary } from "@librecord/domain";
import { useChannels } from "@librecord/app";
import { useVoice } from "@librecord/app";
import CreateGuildModal from "../../pages/guild/CreateGuildModal";
import { JoinGuildModal } from "../../components/guild/JoinGuildModal";
import { StatusDot } from "../../components/user/StatusDot";
import { usePresence } from "@librecord/app";
import { useGuildSettings } from "@librecord/app";
import { useToast } from "@librecord/app";
import { ConfirmModal } from "../ui/ConfirmModal";
import { onCustomEvent, onEvent } from "@librecord/app";
import type { AppEventMap } from "@librecord/domain";
import { useUnreadContext } from "@librecord/app";
import { API_URL } from "@librecord/api-client";
import { logger } from "@librecord/domain";
import { STORAGE, DEFAULT_AVATAR } from "@librecord/domain";
import { useGuildFolders } from "@librecord/app";
import { FolderSettingsModal } from "./FolderSettingsModal";
import { ChatBubbleIcon, PlusIcon, LoginArrowIcon } from "../ui/Icons";

function SidebarIcon({
    children,
    active,
    unread,
    tooltip,
    className = "",
    onClick,
    to,
    testId,
    ariaLabel,
}: {
    children: React.ReactNode;
    active?: boolean;
    unread?: boolean;
    tooltip?: string;
    className?: string;
    onClick?: () => void;
    to?: string;
    testId?: string;
    ariaLabel?: string;
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
                role="button"
                aria-label={ariaLabel ?? tooltip}
                onClick={onClick}
                className={`
                    w-12 h-12 flex items-center justify-center relative
                    transition-all duration-200 cursor-pointer hover:scale-110
                    ${active ? "rounded-2xl scale-105" : "rounded-full hover:rounded-2xl"}
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

    const { counts: unreadCounts } = useUnreadContext();
    const [channelToGuild, setChannelToGuild] = useState<Record<string, string>>({});
    const [dmChannelIds, setDmChannelIds] = useState<Set<string>>(new Set());

    const isDmPage = !guildId && location.pathname.startsWith("/app/dm");
    const activeDmId = isDmPage ? location.pathname.match(/^\/app\/dm\/([^/]+)/)?.[1] : undefined;

    const loadGuilds = useCallback(() => {
        getGuilds().then(async (list) => {
            setGuilds(list);
            const map: Record<string, string> = {};
            for (const g of list) {
                const channels = await getGuildChannels(g.id);
                for (const ch of channels) map[ch.id] = g.id;
            }
            setChannelToGuild(map);
        }).catch(e => logger.api.warn("Failed to load guilds", e));
    }, [getGuilds, getGuildChannels]);

    // Track DM channel IDs so we can derive DM unread state
    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:message:ping"]>("dm:message:ping", (detail) => {
            setDmChannelIds(prev => {
                if (prev.has(detail.channelId)) return prev;
                const next = new Set(prev);
                next.add(detail.channelId);
                return next;
            });
        });
    }, []);

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

    // Derive guild-level and DM unreads from the shared UnreadContext
    const guildHasUnread = useCallback((gId: string) => {
        return Object.entries(channelToGuild)
            .some(([chId, g]) => g === gId && (unreadCounts[chId] ?? 0) > 0);
    }, [unreadCounts, channelToGuild]);

    const hasDmUnread = Array.from(dmChannelIds)
        .some(chId => chId !== activeDmId && (unreadCounts[chId] ?? 0) > 0);

    const avatarSrc =
        user?.avatarUrl
            ? `${API_URL}${user.avatarUrl}`
            : DEFAULT_AVATAR;

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
                aria-label="Server navigation"
                role="navigation"
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

                <SidebarIcon to={getLastVisited().dm || "/app/dm"} active={isDmPage} unread={hasDmUnread} tooltip="Direct Messages" testId="dm-btn" className="bg-[#313338] hover:bg-[#5865F2] text-white">
                    <ChatBubbleIcon size={24} />
                </SidebarIcon>

                <div className="w-8 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[#5865F2]/40 to-transparent" />

                {/* Folders */}
                {folders.map(folder => {
                    const folderGuilds = folder.guildIds.map(id => guilds.find(g => g.id === id)).filter(Boolean) as GuildSummary[];
                    if (folderGuilds.length === 0) return null;
                    const isExpanded = expandedFolders.has(folder.id);
                    const folderColor = folder.color ?? "#5865F2";
                    const hasUnread = folderGuilds.some(g => guildHasUnread(g.id));
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
                                                    to={guildId === g.id ? undefined : (getLastVisited()[`guild:${g.id}`] || `/app/guild/${g.id}`)}
                                                    active={guildId === g.id}
                                                    unread={guildHasUnread(g.id)}
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
                            to={guildId === g.id ? undefined : (getLastVisited()[`guild:${g.id}`] || `/app/guild/${g.id}`)}
                            active={guildId === g.id}
                            unread={guildHasUnread(g.id)}
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
                    <PlusIcon size={24} />
                </SidebarIcon>

                <SidebarIcon
                    onClick={() => setShowJoin(true)}
                    tooltip="Join a Guild"
                    testId="join-guild-btn"
                    className="bg-[#313338] hover:bg-[#5865F2] text-[#248046] hover:text-white"
                >
                    <LoginArrowIcon size={20} />
                </SidebarIcon>

                <div className="flex-1" />

                <Link to="/app/settings/user/profile" aria-label="User Settings" data-testid="user-avatar-btn">
                    <div className="relative group flex items-center">
                        <img
                            src={avatarSrc}
                            alt="User Settings"
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
                        role="menu"
                        aria-label="Guild actions"
                    >
                        {guildCtxMenu.guild.ownerId !== user?.userId && (
                            <button
                                role="menuitem"
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
                    <div role="dialog" aria-modal="true" aria-label={removedNotice.action === "ban" ? "You have been banned" : "You have been kicked"} className="bg-[#313338] rounded-lg p-6 w-full max-w-sm shadow-xl text-center" onClick={e => e.stopPropagation()}>
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
