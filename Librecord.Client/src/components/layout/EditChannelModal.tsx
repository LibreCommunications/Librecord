import { useState } from "react";
import type { GuildChannel } from "../../hooks/useChannels";

interface EditChannelModalProps {
    target: GuildChannel | null;
    categories: GuildChannel[];
    onSave: (channelId: string, data: { name: string; topic?: string | null; parentId?: string | null }) => Promise<void>;
    onClose: () => void;
}

export function EditChannelModal({ target, categories, onSave, onClose }: EditChannelModalProps) {
    const [prevTarget, setPrevTarget] = useState<GuildChannel | null>(null);
    const [editName, setEditName] = useState("");
    const [editTopic, setEditTopic] = useState("");
    const [editParentId, setEditParentId] = useState<string | null>(null);

    if (target !== prevTarget) {
        setPrevTarget(target);
        if (target) {
            setEditName(target.name);
            setEditTopic(target.topic ?? "");
            setEditParentId(target.parentId ?? null);
        }
    }

    if (!target) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center" onClick={onClose}>
            <div className="bg-[#313338] rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-white mb-4">
                    {target.type === 2 ? "Edit Category" : "Edit Channel"}
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-1">
                            {target.type === 2 ? "Category Name" : "Channel Name"}
                        </label>
                        <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            maxLength={64}
                            className="w-full bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 outline-none border border-[#3f4147] focus:border-[#5865F2]"
                        />
                    </div>
                    {target.type !== 2 && (
                        <div>
                            <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-1">Topic</label>
                            <input
                                value={editTopic}
                                onChange={e => setEditTopic(e.target.value)}
                                maxLength={1024}
                                placeholder="What's this channel about?"
                                className="w-full bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 outline-none border border-[#3f4147] focus:border-[#5865F2]"
                            />
                        </div>
                    )}
                    {target.type !== 2 && categories.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-1">Category</label>
                            <select
                                value={editParentId ?? ""}
                                onChange={e => setEditParentId(e.target.value || null)}
                                className="w-full bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 outline-none border border-[#3f4147] focus:border-[#5865F2]"
                            >
                                <option value="">No category</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-white hover:underline">Cancel</button>
                    <button
                        onClick={async () => {
                            if (!editName.trim()) return;
                            if (target.type === 2) {
                                await onSave(target.id, { name: editName.trim() });
                            } else {
                                await onSave(target.id, { name: editName.trim(), topic: editTopic.trim() || null, parentId: editParentId });
                            }
                        }}
                        className="px-4 py-2 rounded bg-[#5865F2] text-white text-sm font-medium hover:bg-[#4752c4]"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
