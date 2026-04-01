import { useEffect, useState } from "react";
import { ShieldIcon, ChevronDownIcon, KickIcon, BanIcon } from "../ui/Icons";
import { useGuildSettings } from "../../hooks/useGuildSettings";
import { useGuildRoles } from "../../hooks/useGuildRoles";
import { ConfirmModal } from "../ui/ConfirmModal";
import { useToast } from "../../hooks/useToast";
import type { GuildRole } from "../../types/guild";

interface Props {
    guildId: string;
    userId: string;
    displayName: string;
    memberRoleIds: string[];
    canManageRoles?: boolean;
    canKick?: boolean;
    canBan?: boolean;
    onClose: () => void;
    onMemberRemoved?: () => void;
    onRolesChanged?: () => void;
}

export function MemberContextMenu({
    guildId, userId, displayName, memberRoleIds,
    canManageRoles, canKick, canBan,
    onClose, onMemberRemoved, onRolesChanged,
}: Props) {
    const { kickMember, banMember } = useGuildSettings();
    const { getRoles, assignRole, removeRole } = useGuildRoles();
    const { toast } = useToast();
    const [confirmAction, setConfirmAction] = useState<"kick" | "ban" | null>(null);
    const [banReason, setBanReason] = useState("");
    const [showRoles, setShowRoles] = useState(false);
    const [guildRoles, setGuildRoles] = useState<GuildRole[]>([]);
    const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set(memberRoleIds));

    useEffect(() => {
        if (showRoles && guildRoles.length === 0) {
            getRoles(guildId).then(r => setGuildRoles(r.filter(role => role.name !== "@everyone")));
        }
    }, [showRoles, guildRoles.length, guildId, getRoles]);

    async function handleKick() {
        if (await kickMember(guildId, userId)) {
            toast(`${displayName} has been kicked.`, "info");
            onMemberRemoved?.();
        }
        setConfirmAction(null);
        onClose();
    }

    async function handleBan() {
        if (await banMember(guildId, userId, banReason || undefined)) {
            toast(`${displayName} has been banned.`, "info");
            onMemberRemoved?.();
        }
        setConfirmAction(null);
        setBanReason("");
        onClose();
    }

    async function toggleRole(roleId: string) {
        const has = assignedIds.has(roleId);
        const ok = has
            ? await removeRole(guildId, roleId, userId)
            : await assignRole(guildId, roleId, userId);
        if (ok) {
            setAssignedIds(prev => {
                const next = new Set(prev);
                if (has) next.delete(roleId); else next.add(roleId);
                return next;
            });
            onRolesChanged?.();
        }
    }

    return (
        <>
            {/* Backdrop to close menu on outside click */}
            <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); onClose(); }} />
            <div role="menu" onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bg-[#111214] rounded-lg shadow-xl py-1.5 w-48 z-50 border border-[#2b2d31] animate-[scaleIn_0.1s_ease-out]">
                {canManageRoles && (
                    <div className="relative">
                        <button
                            onClick={() => setShowRoles(!showRoles)}
                            className="w-full text-left px-3 py-1.5 text-sm text-[#dbdee1] hover:bg-[#4752c4] hover:text-white flex items-center gap-2 transition-colors"
                        >
                            <ShieldIcon size={16} />
                            Roles
                            <ChevronDownIcon size={12} className={`ml-auto transition-transform ${showRoles ? "rotate-180" : ""}`} />
                        </button>
                        {showRoles && guildRoles.length > 0 && (
                            <div className="px-2 py-1 max-h-40 overflow-y-auto">
                                {guildRoles.map(role => (
                                    <button
                                        key={role.id}
                                        onClick={() => toggleRole(role.id)}
                                        className="w-full text-left px-2 py-1 text-sm text-[#dbdee1] hover:bg-white/10 rounded flex items-center gap-2"
                                    >
                                        <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                                            assignedIds.has(role.id) ? "bg-[#5865F2] border-[#5865F2] text-white" : "border-[#4e5058]"
                                        }`}>
                                            {assignedIds.has(role.id) && "✓"}
                                        </span>
                                        <span className="truncate">{role.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {canKick && (
                    <button
                        onClick={() => setConfirmAction("kick")}
                        className="w-full text-left px-3 py-1.5 text-sm text-[#f0b132] hover:bg-[#f0b132] hover:text-white flex items-center gap-2 transition-colors"
                    >
                        <KickIcon size={16} />
                        Kick
                    </button>
                )}
                {canBan && (
                    <button
                        onClick={() => setConfirmAction("ban")}
                        className="w-full text-left px-3 py-1.5 text-sm text-[#f23f43] hover:bg-[#f23f43] hover:text-white flex items-center gap-2 transition-colors"
                    >
                        <BanIcon size={16} />
                        Ban
                    </button>
                )}
            </div>

            <ConfirmModal
                open={confirmAction === "kick"}
                title={`Kick ${displayName}`}
                description={`Are you sure you want to kick ${displayName}? They will be able to rejoin with an invite link.`}
                confirmLabel="Kick"
                confirmVariant="danger"
                onConfirm={handleKick}
                onCancel={() => setConfirmAction(null)}
            />

            {confirmAction === "ban" && (
                <div className="modal-overlay-animated" onClick={() => setConfirmAction(null)}>
                    <div onClick={e => e.stopPropagation()} className="w-[440px] modal-card-animated">
                        <div className="p-4">
                            <h2 className="text-xl font-semibold text-white mb-2">Ban {displayName}</h2>
                            <p className="text-sm text-[#b5bac1] mb-4">
                                Are you sure you want to ban {displayName}? They will not be able to rejoin unless unbanned.
                            </p>
                            <label className="block section-label mb-2">Reason (optional)</label>
                            <input
                                value={banReason}
                                onChange={e => setBanReason(e.target.value)}
                                placeholder="Enter a reason..."
                                className="input-field"
                            />
                        </div>
                        <div className="flex justify-end gap-3 px-4 py-3 bg-[#2b2d31]">
                            <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm text-white hover:underline">Cancel</button>
                            <button onClick={handleBan} className="px-4 py-2 rounded text-sm font-medium bg-[#da373c] hover:bg-[#a12828] text-white transition-colors">Ban</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
