import { useCallback, useEffect, useState } from "react";
import { usePins, type PinnedMessage } from "../../hooks/usePins";

interface Props {
    channelId: string;
    onClose: () => void;
}

export function PinnedMessagesPanel({ channelId, onClose }: Props) {
    const { getPins, unpinMessage } = usePins();
    const [pins, setPins] = useState<PinnedMessage[]>([]);
    const [loading, setLoading] = useState(true);

    const loadPins = useCallback(() => {
        setLoading(true);
        getPins(channelId).then(p => {
            setPins(p);
            setLoading(false);
        });
    }, [getPins, channelId]);

    useEffect(() => {
        loadPins();
    }, [loadPins]);

    // Refresh pin list on realtime pin/unpin events
    useEffect(() => {
        const onPinChanged = (e: CustomEvent<{ channelId: string; messageId: string }>) => {
            if (e.detail.channelId !== channelId) return;
            loadPins();
        };

        window.addEventListener("channel:message:pinned", onPinChanged as EventListener);
        window.addEventListener("channel:message:unpinned", onPinChanged as EventListener);
        return () => {
            window.removeEventListener("channel:message:pinned", onPinChanged as EventListener);
            window.removeEventListener("channel:message:unpinned", onPinChanged as EventListener);
        };
    }, [channelId, loadPins]);

    async function handleUnpin(messageId: string) {
        if (await unpinMessage(channelId, messageId)) {
            setPins(prev => prev.filter(p => p.messageId !== messageId));
        }
    }

    return (
        <div className="w-80 bg-[#2b2d31] border-l border-black/20 flex flex-col">
            <div className="h-12 flex items-center justify-between px-4 border-b border-black/20">
                <span className="font-semibold text-sm">Pinned Messages</span>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">x</button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading && <div className="text-sm text-gray-500">Loading...</div>}

                {!loading && pins.length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-4">No pinned messages</div>
                )}

                {pins.map(pin => (
                    <div key={pin.messageId} className="bg-[#1e1f22] rounded p-3 text-sm" data-testid="pin-card">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-200">{pin.author.displayName}</span>
                            <button
                                onClick={() => handleUnpin(pin.messageId)}
                                className="text-xs text-gray-500 hover:text-red-400"
                            >
                                Unpin
                            </button>
                        </div>
                        <p className="text-gray-300 whitespace-pre-wrap">{pin.content}</p>
                        <div className="text-xs text-gray-500 mt-1">
                            Pinned by {pin.pinnedBy.displayName}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
