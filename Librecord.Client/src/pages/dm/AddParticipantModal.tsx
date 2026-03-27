import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useFriends, type FriendshipListDto } from "../../hooks/useFriends";
import {
    useDirectMessagesChannel,
    type DmUser
} from "../../hooks/useDirectMessagesChannel";

interface Props {
    channelId: string;
    members: DmUser[];
    onClose: () => void;
}

export function AddParticipantModal({
                                        channelId,
                                        members,
                                        onClose
                                    }: Props) {
    const { getFriends } = useFriends();
    const { addParticipant } = useDirectMessagesChannel();

    const [friends, setFriends] = useState<FriendshipListDto[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);

    const loadFriends = useCallback(() => {
        getFriends().then(setFriends);
    }, [getFriends]);

    useEffect(() => {
        loadFriends();
    }, [loadFriends]);

    const memberIds = useMemo(
        () => new Set(members.map(m => m.id)),
        [members]
    );

    const filtered = friends.filter(f =>
        !memberIds.has(f.otherUserId) &&
        (
            f.otherUsername.toLowerCase().includes(query.toLowerCase()) ||
            f.otherDisplayName.toLowerCase().includes(query.toLowerCase())
        )
    );

    async function handleAdd(userId: string) {
        if (loading) return;

        setLoading(true);
        const ok = await addParticipant(channelId, userId);
        setLoading(false);

        if (ok) onClose();
    }

    return createPortal(
        <div className="modal-overlay-animated">
            <div className="w-full max-w-md rounded-lg bg-[#313338] p-5 shadow-xl animate-[scaleIn_0.15s_ease-out]">

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">
                        Add friend to group
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search friends…"
                    className="
                        w-full mb-3 px-3 py-2 rounded
                        bg-[#2b2d31] text-white
                        outline-none
                        focus:ring-2 focus:ring-[#5865F2]
                    "
                />

                <div className="max-h-64 overflow-y-auto space-y-1">
                    {filtered.length === 0 && (
                        <div className="text-sm text-gray-400">
                            No friends available
                        </div>
                    )}

                    {filtered.map(f => (
                        <button
                            key={f.otherUserId}
                            disabled={loading}
                            onClick={() => handleAdd(f.otherUserId)}
                            className="
                                w-full flex items-center gap-3
                                px-3 py-2 rounded
                                hover:bg-[#2b2d31]
                                text-left
                                disabled:opacity-50
                            "
                        >
                            <img
                                src={
                                    f.otherAvatarUrl
                                        ? `${import.meta.env.VITE_API_URL}${f.otherAvatarUrl}`
                                        : "/default-avatar.png"
                                }
                                className="w-8 h-8 rounded-full object-cover bg-[#313338]"
                            />

                            <div className="flex-1">
                                <div className="font-medium text-white">
                                    {f.otherDisplayName}
                                </div>
                                <div className="text-xs text-gray-400">
                                    @{f.otherUsername}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
