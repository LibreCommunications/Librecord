import { useState } from "react";
import { useGuildSettings } from "../../hooks/useGuildSettings";
import { ConfirmModal } from "../ui/ConfirmModal";
import { useToast } from "../../hooks/useToast";

interface Props {
    guildId: string;
    userId: string;
    displayName: string;
    onClose: () => void;
    onMemberRemoved?: () => void;
}

export function MemberContextMenu({ guildId, userId, displayName, onClose, onMemberRemoved }: Props) {
    const { kickMember, banMember } = useGuildSettings();
    const { toast } = useToast();
    const [confirmAction, setConfirmAction] = useState<"kick" | "ban" | null>(null);
    const [banReason, setBanReason] = useState("");

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

    return (
        <>
            <div className="absolute right-0 top-0 bg-[#111214] rounded-lg shadow-xl py-1.5 w-44 z-50 border border-[#2b2d31] animate-[scaleIn_0.1s_ease-out]">
                <button
                    onClick={() => setConfirmAction("kick")}
                    className="w-full text-left px-3 py-1.5 text-sm text-[#f0b132] hover:bg-[#f0b132] hover:text-white flex items-center gap-2 transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="18" y1="8" x2="23" y2="13" />
                        <line x1="23" y1="8" x2="18" y2="13" />
                    </svg>
                    Kick
                </button>
                <button
                    onClick={() => setConfirmAction("ban")}
                    className="w-full text-left px-3 py-1.5 text-sm text-[#f23f43] hover:bg-[#f23f43] hover:text-white flex items-center gap-2 transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                    Ban
                </button>
            </div>

            <ConfirmModal
                open={confirmAction === "kick"}
                title={`Kick ${displayName}`}
                description={`Are you sure you want to kick ${displayName} from the server? They will be able to rejoin with an invite link.`}
                confirmLabel="Kick"
                confirmVariant="danger"
                onConfirm={handleKick}
                onCancel={() => setConfirmAction(null)}
            />

            {confirmAction === "ban" && (
                <div
                    className="modal-overlay-animated"
                    onClick={() => setConfirmAction(null)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="w-[440px] modal-card-animated"
                    >
                        <div className="p-4">
                            <h2 className="text-xl font-semibold text-white mb-2">Ban {displayName}</h2>
                            <p className="text-sm text-[#b5bac1] mb-4">
                                Are you sure you want to ban {displayName}? They will not be able to rejoin unless unbanned.
                            </p>
                            <label className="block section-label mb-2">
                                Reason (optional)
                            </label>
                            <input
                                value={banReason}
                                onChange={e => setBanReason(e.target.value)}
                                placeholder="Enter a reason..."
                                className="input-field"
                            />
                        </div>
                        <div className="flex justify-end gap-3 px-4 py-3 bg-[#2b2d31]">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="px-4 py-2 text-sm text-white hover:underline"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBan}
                                className="px-4 py-2 rounded text-sm font-medium bg-[#da373c] hover:bg-[#a12828] text-white transition-colors"
                            >
                                Ban
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
