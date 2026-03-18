import { useState } from "react";

interface Props {
    open: boolean;
    onClose: () => void;
    onCreate: (name: string) => Promise<void>;
}

export default function CreateGuildModal({
                                             open,
                                             onClose,
                                             onCreate
                                         }: Props) {
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    async function handleCreate() {
        if (!name.trim() || loading) return;

        setLoading(true);
        await onCreate(name.trim());
        setLoading(false);
        setName("");
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-[fadeIn_0.15s_ease-out]"
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="w-[440px] bg-[#313338] rounded-lg shadow-xl p-6 text-gray-200 animate-[scaleIn_0.15s_ease-out]"
            >
                <h2 className="text-xl font-semibold mb-2">
                    Create a guild
                </h2>

                <p className="text-sm text-gray-400 mb-6">
                    Give your guild a name. You can always change it later.
                </p>

                <label className="block text-xs font-bold text-gray-400 mb-1">
                    GUILD NAME
                </label>

                <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="My Guild"
                    className="
                        w-full px-3 py-2 rounded
                        bg-[#1e1f22] text-white
                        outline-none border border-black/30
                        focus:border-[#5865F2]
                    "
                />

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-300 hover:underline"
                    >
                        Cancel
                    </button>

                    <button
                        disabled={!name.trim() || loading}
                        onClick={handleCreate}
                        className="
                            px-4 py-2 rounded text-sm font-medium
                            bg-[#5865F2] text-white
                            disabled:opacity-50
                        "
                    >
                        {loading ? "Creating..." : "Create Guild"}
                    </button>
                </div>
            </div>
        </div>
    );
}
