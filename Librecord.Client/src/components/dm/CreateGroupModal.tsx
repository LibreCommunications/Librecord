import { useEffect, useState } from "react";
import { useFriends, type FriendshipListDto } from "../../hooks/useFriends";
import { useDirectMessagesChannel } from "../../hooks/useDirectMessagesChannel";
import { useUserProfile } from "../../hooks/useUserProfile";

interface Props {
    onClose: () => void;
    onCreated: (channelId: string) => void;
}

export function CreateGroupModal({ onClose, onCreated }: Props) {
    const { getFriends } = useFriends();
    const { createGroup } = useDirectMessagesChannel();
    const { getAvatarUrl } = useUserProfile();

    const [friends, setFriends] = useState<FriendshipListDto[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        getFriends().then(list => {
            setFriends(list);
            setLoading(false);
        });
    }, []);

    function toggle(userId: string) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    }

    async function handleCreate() {
        if (selected.size === 0) return;
        setCreating(true);
        const channelId = await createGroup(Array.from(selected));
        setCreating(false);
        if (channelId) onCreated(channelId);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="bg-[#313338] rounded-lg w-[440px] max-h-[500px] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-[#1e1f22]">
                    <h2 className="text-white text-lg font-semibold">Create Group DM</h2>
                    <p className="text-[#949ba4] text-sm mt-1">Select friends to add to the group.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 dark-scrollbar">
                    {loading && <p className="text-[#949ba4] text-sm px-2 py-4">Loading friends...</p>}

                    {!loading && friends.length === 0 && (
                        <p className="text-[#949ba4] text-sm px-2 py-4">No friends to add. Add some friends first!</p>
                    )}

                    {friends.map(f => (
                        <button
                            key={f.otherUserId}
                            onClick={() => toggle(f.otherUserId)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                                selected.has(f.otherUserId) ? "bg-[#5865F2]/20" : "hover:bg-[#35373c]"
                            }`}
                        >
                            <img
                                src={getAvatarUrl(f.otherAvatarUrl)}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                            <span className="text-sm text-[#dbdee1] flex-1 text-left truncate">
                                {f.otherDisplayName}
                                <span className="text-[#949ba4] ml-1">@{f.otherUsername}</span>
                            </span>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                selected.has(f.otherUserId)
                                    ? "bg-[#5865F2] border-[#5865F2]"
                                    : "border-[#949ba4]"
                            }`}>
                                {selected.has(f.otherUserId) && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </div>
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-[#1e1f22] flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-[#dbdee1] hover:underline"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={selected.size === 0 || creating}
                        className="px-4 py-2 text-sm bg-[#5865F2] text-white rounded hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {creating ? "Creating..." : `Create Group (${selected.size})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
