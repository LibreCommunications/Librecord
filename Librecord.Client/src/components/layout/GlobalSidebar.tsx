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

    // ── Remember last visited paths ──────────────────────────
    const LAST_VISITED_KEY = "librecord:lastVisited";

    function getLastVisited(): Record<string, string> {
        try { return JSON.parse(localStorage.getItem(LAST_VISITED_KEY) ?? "{}"); } catch { return {}; }
    }

    const saveLastVisited = useCallback((key: string, path: string) => {
        const lv = getLastVisited();
        lv[key] = path;
        localStorage.setItem(LAST_VISITED_KEY, JSON.stringify(lv));
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
    const { myStatus } = usePresence();
    const { voiceState, leaveVoice } = useVoice();

    // ── Guild Folders (client-only, localStorage) ────────────
    interface GuildFolder { id: string; name?: string; color?: string; guildIds: string[]; }
    const FOLDERS_KEY = "librecord:guildFolders";

    const [folders, setFolders] = useState<GuildFolder[]>(() => {
        try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "[]"); } catch { return []; }
    });
    const EXPANDED_KEY = "librecord:expandedFolders";
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
        try { return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]")); } catch { return new Set(); }
    });
    const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
    const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [renameColor, setRenameColor] = useState("");

    function toggleExpandFolder(folderId: string) {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
            localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
            return next;
        });
    }

    function saveFolders(next: GuildFolder[]) {
        setFolders(next);
        localStorage.setItem(FOLDERS_KEY, JSON.stringify(next));
    }

    const folderedGuildIds = new Set(folders.flatMap(f => f.guildIds));

    function createFolder(guildA: string, guildB: string) {
        const folder: GuildFolder = { id: crypto.randomUUID(), guildIds: [guildA, guildB] };
        saveFolders([...folders, folder]);
        toggleExpandFolder(folder.id);
    }

    function updateFolder(folderId: string, name: string, color?: string) {
        saveFolders(folders.map(f => f.id === folderId ? { ...f, name: name.trim() || undefined, color: color || undefined } : f));
    }

    function removeFromFolder(folderId: string, guildId: string) {
        const updated = folders.map(f => f.id === folderId ? { ...f, guildIds: f.guildIds.filter(id => id !== guildId) } : f)
            .filter(f => f.guildIds.length >= 2); // dissolve folders with < 2 guilds
        saveFolders(updated);
    }

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

            {renamingFolder && (
                <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center" onClick={() => setRenamingFolder(null)}>
                    <div className="bg-[#313338] rounded-lg p-5 w-[340px] shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-white mb-3">Folder Settings</h2>

                        <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1">Name</label>
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { updateFolder(renamingFolder, renameValue, renameColor); setRenamingFolder(null); } }}
                            maxLength={32}
                            placeholder="Folder name"
                            className="w-full px-3 py-2 rounded bg-[#1e1f22] text-white outline-none border border-[#3f4147] focus:border-[#5865F2] mb-3"
                        />

                        <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1">Color</label>
                        <div className="flex items-center gap-3 mb-1">
                            <input
                                type="color"
                                value={renameColor || "#5865F2"}
                                onChange={e => setRenameColor(e.target.value)}
                                className="w-10 h-10 rounded-full border-0 cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/20 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-2 [&::-moz-color-swatch]:border-white/20"
                            />
                            <span className="text-sm text-[#949ba4] font-mono">{(renameColor || "#5865F2").toUpperCase()}</span>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setRenamingFolder(null)} className="px-3 py-1.5 text-sm text-white hover:underline">Cancel</button>
                            <button
                                onClick={() => { updateFolder(renamingFolder, renameValue, renameColor); setRenamingFolder(null); }}
                                className="px-4 py-1.5 rounded bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-medium"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
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
