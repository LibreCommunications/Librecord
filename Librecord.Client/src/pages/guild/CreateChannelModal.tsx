import { useState } from "react";

interface Props {
    open: boolean;
    onClose: () => void;
    onCreate: (data: {
        name: string;
        type: number;
        topic?: string | null;
    }) => Promise<void>;
}

export default function CreateChannelModal({
                                               open,
                                               onClose,
                                               onCreate
                                           }: Props) {
    const [name, setName] = useState("");
    const [topic, setTopic] = useState("");
    const [channelType, setChannelType] = useState(0); // 0 = Text, 1 = Voice
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    async function handleCreate() {
        if (!name.trim() || loading) return;

        setLoading(true);
        await onCreate({
            name: name.trim(),
            type: channelType,
            topic: topic.trim() || null
        });
        setLoading(false);
        setName("");
        setTopic("");
        setChannelType(0);
        onClose();
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-[fadeIn_0.15s_ease-out]"
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="w-[420px] bg-[#313338] rounded-lg shadow-xl p-6 text-gray-200 animate-[scaleIn_0.15s_ease-out]"
            >
                <h2 className="text-xl font-semibold mb-4">
                    Create Channel
                </h2>

                <label className="block text-xs font-bold text-gray-400 mb-1">
                    CHANNEL TYPE
                </label>
                <div className="flex gap-2 mb-3">
                    <button
                        type="button"
                        onClick={() => setChannelType(0)}
                        className={`
                            flex-1 px-3 py-2 rounded text-sm font-medium border
                            ${channelType === 0
                                ? "bg-[#5865F2] border-[#5865F2] text-white"
                                : "bg-[#1e1f22] border-black/30 text-gray-400 hover:text-white"}
                        `}
                    >
                        # Text
                    </button>
                    <button
                        type="button"
                        onClick={() => setChannelType(1)}
                        className={`
                            flex-1 px-3 py-2 rounded text-sm font-medium border
                            ${channelType === 1
                                ? "bg-[#5865F2] border-[#5865F2] text-white"
                                : "bg-[#1e1f22] border-black/30 text-gray-400 hover:text-white"}
                        `}
                    >
                        Voice
                    </button>
                </div>

                <label className="block text-xs font-bold text-gray-400 mb-1">
                    CHANNEL NAME
                </label>

                <input
                    autoFocus
                    required
                    minLength={1}
                    maxLength={64}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="general"
                    className="
                        w-full px-3 py-2 rounded mb-3
                        bg-[#1e1f22] text-white
                        outline-none border border-black/30
                        focus:border-[#5865F2]
                    "
                />

                <label className="block text-xs font-bold text-gray-400 mb-1">
                    TOPIC (optional)
                </label>

                <input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="What is this channel about?"
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
                        {loading ? "Creating..." : "Create Channel"}
                    </button>
                </div>
            </div>
        </div>
    );
}
