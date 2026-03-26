import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGuilds } from "../../hooks/useGuilds";
import { useGuildSettings } from "../../hooks/useGuildSettings";
import { useGuildPermissions } from "../../hooks/useGuildPermissions";
import { useToast } from "../../hooks/useToast";
import { GuildRoleSettings } from "./GuildRoleSettings";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { Spinner } from "../../components/ui/Spinner";

export default function GuildSettingsPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const navigate = useNavigate();
    const { getGuild } = useGuilds();
    const { updateGuild, deleteGuild } = useGuildSettings();
    const { permissions, loaded: permsLoaded } = useGuildPermissions(guildId);
    const { toast } = useToast();

    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState<"general" | "roles" | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (!guildId) return;
        getGuild(guildId).then(g => {
            if (g) setName(g.name);
        });
    }, [guildId, getGuild]);

    async function handleSave() {
        if (!guildId || !name.trim()) return;
        setSaving(true);
        await updateGuild(guildId, { name: name.trim() });
        setSaving(false);
        toast("Server settings saved!", "success");
    }

    if (!guildId) return null;

    if (permsLoaded && tab === null) {
        if (permissions.isOwner) setTab("general");
    }

    if (permsLoaded && !permissions.isOwner) {
        navigate(`/app/guild/${guildId}`, { replace: true });
        return null;
    }

    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-y-auto">
            <div className="max-w-2xl mx-auto w-full p-8">
                <h1 className="text-2xl font-bold text-white mb-6">Server Settings</h1>

                <div className="flex gap-4 mb-6 border-b border-[#3f4147] pb-2">
                    <button
                        onClick={() => setTab("general")}
                        className={`pb-2 text-sm font-medium ${tab === "general" ? "text-white border-b-2 border-[#5865F2]" : "text-[#949ba4] hover:text-[#dbdee1]"}`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setTab("roles")}
                        className={`pb-2 text-sm font-medium ${tab === "roles" ? "text-white border-b-2 border-[#5865F2]" : "text-[#949ba4] hover:text-[#dbdee1]"}`}
                    >
                        Roles
                    </button>
                </div>

                {tab === "general" && (
                    <div className="space-y-6">
                        <div>
                            <label className="block section-label mb-2">
                                Server Name
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
                                Once you delete a server, there is no going back. All channels, messages, and members will be permanently removed.
                            </p>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-4 py-2 rounded-[4px] bg-[#da373c] text-white font-medium hover:bg-[#a12828] transition-colors"
                            >
                                Delete Server
                            </button>
                        </div>
                    </div>
                )}

                {tab === "roles" && (
                    <GuildRoleSettings guildId={guildId} />
                )}
            </div>

            <ConfirmModal
                open={showDeleteConfirm}
                title="Delete Server"
                description={`Are you sure you want to delete this server? This will permanently remove all channels, messages, and members. This action cannot be undone.`}
                confirmLabel="Delete Server"
                confirmVariant="danger"
                onConfirm={async () => {
                    if (await deleteGuild(guildId)) {
                        // Dispatch locally so GlobalSidebar removes the icon immediately
                        // (the SignalR event may arrive after navigation)
                        window.dispatchEvent(
                            new CustomEvent("guild:deleted", { detail: { guildId } })
                        );
                        toast("Server deleted.", "info");
                        navigate("/app/dm");
                    }
                    setShowDeleteConfirm(false);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
}
