import { useState } from "react";
import { useGuildInvites } from "@librecord/app";

interface Props {
    onClose: () => void;
    onJoined: (guild: { id: string; name: string }) => void;
}

export function JoinGuildModal({ onClose, onJoined }: Props) {
    const { joinByCode, getInvitePreview } = useGuildInvites();
    const [code, setCode] = useState("");
    const [preview, setPreview] = useState<{ name: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handlePreview() {
        if (!code.trim()) return;
        setError(null);

        const result = await getInvitePreview(code.trim());
        if (result) {
            setPreview({ name: result.guild.name });
        } else {
            setError("Invalid or expired invite code.");
            setPreview(null);
        }
    }

    async function handleJoin() {
        if (!code.trim()) return;
        setLoading(true);
        setError(null);

        const result = await joinByCode(code.trim());
        if (result.ok) {
            onJoined(result.guild);
            onClose();
        } else {
            setError(result.error);
        }

        setLoading(false);
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
            <div className="bg-[#313338] rounded-lg p-6 w-[440px] shadow-xl animate-[scaleIn_0.15s_ease-out]" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-4">
                    Join a Server
                </h2>

                <label className="block text-sm font-medium text-gray-300 mb-1">
                    Invite Code
                </label>
                <input
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    onBlur={handlePreview}
                    onKeyDown={e => e.key === "Enter" && handleJoin()}
                    placeholder="e.g. AbCdEfGh"
                    className="w-full px-3 py-2 rounded bg-[#1e1f22] text-white mb-3"
                />

                {preview && (
                    <p className="text-sm text-green-400 mb-3">
                        You'll join: <strong>{preview.name}</strong>
                    </p>
                )}

                {error && (
                    <p className="text-sm text-red-400 mb-3">{error}</p>
                )}

                <button
                    onClick={handleJoin}
                    disabled={loading || !code.trim()}
                    className="w-full py-2 rounded bg-[#5865F2] text-white font-medium hover:bg-[#4752c4] disabled:opacity-50"
                >
                    {loading ? "Joining..." : "Join Guild"}
                </button>

                <button
                    onClick={onClose}
                    className="mt-3 w-full py-2 text-sm text-gray-400 hover:text-white"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
