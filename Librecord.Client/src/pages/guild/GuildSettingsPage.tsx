import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGuilds } from "../../hooks/useGuilds";
import { useGuildSettings } from "../../hooks/useGuildSettings";
import { useGuildPermissions } from "../../hooks/useGuildPermissions";
import { useToast } from "../../hooks/useToast";
import { guilds as guildsApi, API_URL } from "../../api/client";
import { GuildRoleSettings } from "./GuildRoleSettings";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { Spinner } from "../../components/ui/Spinner";

export default function GuildSettingsPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const navigate = useNavigate();
    const { getGuild } = useGuilds();
    const { updateGuild, deleteGuild, leaveGuild } = useGuildSettings();
    const { permissions, loaded: permsLoaded } = useGuildPermissions(guildId);
    const { toast } = useToast();

    const [name, setName] = useState("");
    const [iconUrl, setIconUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploadingIcon, setUploadingIcon] = useState(false);
    const [tab, setTab] = useState<"general" | "roles" | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const iconInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!guildId) return;
        getGuild(guildId).then(g => {
            if (g) { setName(g.name); setIconUrl(g.iconUrl ?? null); }
        });
    }, [guildId, getGuild]);

    async function handleSave() {
        if (!guildId || !name.trim()) return;
        setSaving(true);
        await updateGuild(guildId, { name: name.trim() });
        setSaving(false);
        toast("Guild settings saved!", "success");
    }

    async function handleIconUpload(file: File) {
        if (!guildId) return;
        if (file.size > 5 * 1024 * 1024) { toast("Image must be under 5 MB.", "error"); return; }
        if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { toast("Only PNG, JPEG, WebP, or GIF.", "error"); return; }
        setUploadingIcon(true);
        try {
            const result = await guildsApi.uploadIcon(guildId, file);
            setIconUrl(`${result.iconUrl}?t=${Date.now()}`);
            toast("Guild icon updated!", "success");
        } catch {
            toast("Failed to upload icon.", "error");
        } finally {
            setUploadingIcon(false);
        }
    }

    if (!guildId) return null;

    const canAccessGeneral = permissions.isOwner || permissions.manageGuild;
    const canAccessRoles = permissions.isOwner || permissions.manageRoles;
    const canAccessSettings = canAccessGeneral || canAccessRoles;

    if (permsLoaded && tab === null) {
        if (canAccessGeneral) setTab("general");
        else if (canAccessRoles) setTab("roles");
    }

    if (permsLoaded && !canAccessSettings && permissions.isOwner) {
        navigate(`/app/guild/${guildId}`, { replace: true });
        return null;
    }

    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-y-auto">
            <div className="max-w-2xl mx-auto w-full p-8">
                <h1 className="text-2xl font-bold text-white mb-6">Guild Settings</h1>

                <div className="flex gap-4 mb-6 border-b border-[#3f4147] pb-2">
                    {canAccessGeneral && (
                        <button
                            onClick={() => setTab("general")}
                            className={`pb-2 text-sm font-medium ${tab === "general" ? "text-white border-b-2 border-[#5865F2]" : "text-[#949ba4] hover:text-[#dbdee1]"}`}
                        >
                            General
                        </button>
                    )}
                    {canAccessRoles && (
                        <button
                            onClick={() => setTab("roles")}
                            className={`pb-2 text-sm font-medium ${tab === "roles" ? "text-white border-b-2 border-[#5865F2]" : "text-[#949ba4] hover:text-[#dbdee1]"}`}
                        >
                            Roles
                        </button>
                    )}
                </div>

                {tab === "general" && (
                    <div className="space-y-6">
                        <div>
                            <label className="block section-label mb-2">Guild Icon</label>
                            <div className="flex items-center gap-4">
                                <div
                                    onClick={() => iconInputRef.current?.click()}
                                    className="w-20 h-20 rounded-2xl bg-[#2b2d31] flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity overflow-hidden border-2 border-dashed border-[#4e5058] hover:border-[#5865F2]"
                                >
                                    {iconUrl ? (
                                        <img src={`${API_URL}${iconUrl}`} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#949ba4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                            <polyline points="21 15 16 10 5 21" />
                                        </svg>
                                    )}
                                </div>
                                <div className="text-sm text-[#949ba4]">
                                    {uploadingIcon ? (
                                        <span className="flex items-center gap-2"><Spinner size="sm" /> Uploading...</span>
                                    ) : (
                                        <span>Click to upload. Max 5 MB.<br />PNG, JPEG, WebP, or GIF.</span>
                                    )}
                                </div>
                                <input
                                    ref={iconInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    className="hidden"
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) handleIconUpload(f);
                                        e.target.value = "";
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block section-label mb-2">
                                Guild Name
                            </label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="input-field"
                            />
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 rounded-[4px] bg-[#5865F2] text-white font-medium hover:bg-[#4752c4] disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {saving && <Spinner size="sm" />}
                            {saving ? "Saving..." : "Save Changes"}
                        </button>

                        <div className="pt-8 border-t border-[#3f4147]">
                            <h2 className="text-lg font-semibold text-[#f23f43] mb-2">Danger Zone</h2>
                            <p className="text-sm text-[#949ba4] mb-3">
                                Once you delete a guild, there is no going back. All channels, messages, and members will be permanently removed.
                            </p>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-4 py-2 rounded-[4px] bg-[#da373c] text-white font-medium hover:bg-[#a12828] transition-colors"
                            >
                                Delete Guild
                            </button>
                        </div>
                    </div>
                )}

                {tab === "roles" && (
                    <GuildRoleSettings guildId={guildId} />
                )}
            </div>

            {!permissions.isOwner && (
                <div className="max-w-2xl mx-auto w-full px-8 pb-8">
                    <div className="pt-4 border-t border-[#3f4147]">
                        <button
                            onClick={() => setShowLeaveConfirm(true)}
                            className="px-4 py-2 rounded-[4px] bg-[#da373c] text-white font-medium hover:bg-[#a12828] transition-colors"
                        >
                            Leave Guild
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={showLeaveConfirm}
                title="Leave Guild"
                description="Are you sure you want to leave this guild? You will need a new invite to rejoin."
                confirmLabel="Leave"
                confirmVariant="danger"
                onConfirm={async () => {
                    if (await leaveGuild(guildId)) {
                        window.dispatchEvent(
                            new CustomEvent("guild:deleted", { detail: { guildId } })
                        );
                        toast("Left the guild.", "info");
                        navigate("/app/dm");
                    }
                    setShowLeaveConfirm(false);
                }}
                onCancel={() => setShowLeaveConfirm(false)}
            />

            <ConfirmModal
                open={showDeleteConfirm}
                title="Delete Guild"
                description={`Are you sure you want to delete this guild? This will permanently remove all channels, messages, and members. This action cannot be undone.`}
                confirmLabel="Delete Guild"
                confirmVariant="danger"
                onConfirm={async () => {
                    if (await deleteGuild(guildId)) {
                        // Dispatch locally so GlobalSidebar removes the icon immediately
                        // (the SignalR event may arrive after navigation)
                        window.dispatchEvent(
                            new CustomEvent("guild:deleted", { detail: { guildId } })
                        );
                        toast("Guild deleted.", "info");
                        navigate("/app/dm");
                    }
                    setShowDeleteConfirm(false);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
}
