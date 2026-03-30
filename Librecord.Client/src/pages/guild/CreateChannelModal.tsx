import { useState } from "react";
import type { GuildChannel } from "../../types/guild";

interface Props {
    open: boolean;
    categories?: GuildChannel[];
    onClose: () => void;
    onCreate: (data: {
        name: string;
        type: number;
        topic?: string | null;
        parentId?: string | null;
    }) => Promise<void>;
}

export default function CreateChannelModal({ open, categories, onClose, onCreate }: Props) {
    const [name, setName] = useState("");
    const [topic, setTopic] = useState("");
    const [channelType, setChannelType] = useState(0); // 0=Text, 1=Voice, 2=Category
    const [parentId, setParentId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    const isCategory = channelType === 2;

    async function handleCreate() {
        if (!name.trim() || loading) return;
        setLoading(true);
        await onCreate({
            name: name.trim(),
            type: channelType,
            topic: isCategory ? null : (topic.trim() || null),
            parentId: isCategory ? null : parentId,
        });
        setLoading(false);
        setName("");
        setTopic("");
        setChannelType(0);
        setParentId(null);
        onClose();
    }

    return (
        <div className="modal-overlay-animated" onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="w-[420px] bg-[#313338] rounded-lg shadow-xl p-6 text-gray-200 animate-[scaleIn_0.15s_ease-out]"
            >
                <h2 className="text-xl font-semibold mb-4">Create Channel</h2>

                <label className="block text-xs font-bold text-gray-400 mb-1">CHANNEL TYPE</label>
                <div className="flex gap-2 mb-3">
                    {([
                        { type: 0, label: "# Text" },
                        { type: 1, label: "🔊 Voice" },
                        { type: 2, label: "📁 Category" },
                    ] as const).map(({ type, label }) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => { setChannelType(type); if (type === 2) setParentId(null); }}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium border ${
                                channelType === type
                                    ? "bg-[#5865F2] border-[#5865F2] text-white"
                                    : "bg-[#1e1f22] border-black/30 text-gray-400 hover:text-white"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <label className="block text-xs font-bold text-gray-400 mb-1">
                    {isCategory ? "CATEGORY NAME" : "CHANNEL NAME"}
                </label>
                <input
                    autoFocus
                    required
                    minLength={1}
                    maxLength={64}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={isCategory ? "My Category" : "general"}
                    className="w-full px-3 py-2 rounded mb-3 bg-[#1e1f22] text-white outline-none border border-black/30 focus:border-[#5865F2]"
                />

                {!isCategory && (
                    <>
                        {categories && categories.length > 0 && (
                            <>
                                <label className="block text-xs font-bold text-gray-400 mb-1">CATEGORY</label>
                                <select
                                    value={parentId ?? ""}
                                    onChange={e => setParentId(e.target.value || null)}
                                    className="w-full px-3 py-2 rounded mb-3 bg-[#1e1f22] text-white outline-none border border-black/30 focus:border-[#5865F2]"
                                >
                                    <option value="">No category</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </>
                        )}

                        <label className="block text-xs font-bold text-gray-400 mb-1">TOPIC (optional)</label>
                        <input
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            placeholder="What is this channel about?"
                            className="w-full px-3 py-2 rounded bg-[#1e1f22] text-white outline-none border border-black/30 focus:border-[#5865F2]"
                        />
                    </>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:underline">Cancel</button>
                    <button
                        disabled={!name.trim() || loading}
                        onClick={handleCreate}
                        className="px-4 py-2 rounded text-sm font-medium bg-[#5865F2] text-white disabled:opacity-50"
                    >
                        {loading ? "Creating..." : isCategory ? "Create Category" : "Create Channel"}
                    </button>
                </div>
            </div>
        </div>
    );
}
