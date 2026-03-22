import { useEffect, useRef, useState } from "react";
import { useGuildInvites } from "../../hooks/useGuildInvites";

interface Props {
    guildId: string;
    onClose: () => void;
}

export function InviteModal({ guildId, onClose }: Props) {
    const { createInvite } = useGuildInvites();
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

    // Clear timeout on unmount
    useEffect(() => {
        return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); };
    }, []);

    async function handleCreate() {
        setLoading(true);
        const invite = await createInvite(guildId);
        if (invite) setInviteCode(invite.code);
        setLoading(false);
    }

    async function handleCopy() {
        if (!inviteCode) return;
        try {
            await navigator.clipboard.writeText(inviteCode);
            setCopied(true);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API may fail without HTTPS
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
            <div className="bg-[#313338] rounded-lg p-6 w-[440px] shadow-xl animate-[scaleIn_0.15s_ease-out]" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-4">
                    Invite People
                </h2>

                {!inviteCode ? (
                    <button
                        onClick={handleCreate}
                        disabled={loading}
                        className="w-full py-2 rounded bg-[#5865F2] text-white font-medium hover:bg-[#4752c4] disabled:opacity-50"
                    >
                        {loading ? "Creating..." : "Generate Invite Link"}
                    </button>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-400">
                            Share this code with others to invite them:
                        </p>
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={inviteCode}
                                className="flex-1 px-3 py-2 rounded bg-[#1e1f22] text-white font-mono text-lg"
                            />
                            <button
                                onClick={handleCopy}
                                className="px-4 py-2 rounded bg-[#5865F2] text-white font-medium hover:bg-[#4752c4]"
                            >
                                {copied ? "Copied!" : "Copy"}
                            </button>
                        </div>
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="mt-4 w-full py-2 text-sm text-gray-400 hover:text-white"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
