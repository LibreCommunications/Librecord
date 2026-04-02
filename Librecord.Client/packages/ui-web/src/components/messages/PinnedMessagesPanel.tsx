import { useCallback, useEffect, useState } from "react";
import { usePins } from "@librecord/app";
import type { PinnedMessage } from "@librecord/domain";
import { onCustomEvent } from "@librecord/app";

interface Props {
    channelId: string;
    onClose: () => void;
}

export function PinnedMessagesPanel({ channelId, onClose }: Props) {
    const { getPins, unpinMessage } = usePins();
    const [pins, setPins] = useState<PinnedMessage[]>([]);
    const [loadedChannel, setLoadedChannel] = useState<string | null>(null);

    const loading = loadedChannel !== channelId;

    const loadPins = useCallback(() => {
        getPins(channelId).then(p => {
            setPins(p);
            setLoadedChannel(channelId);
        });
    }, [getPins, channelId]);

    useEffect(() => {
        let cancelled = false;
        getPins(channelId).then(p => {
            if (!cancelled) {
                setPins(p);
                setLoadedChannel(channelId);
            }
        });
        return () => { cancelled = true; };
    }, [getPins, channelId]);

    useEffect(() => {
        const handler = (detail: { channelId: string; messageId: string }) => {
            if (detail.channelId !== channelId) return;
            loadPins();
        };

        const cleanups = [
            onCustomEvent<{ channelId: string; messageId: string }>("channel:message:pinned", handler),
            onCustomEvent<{ channelId: string; messageId: string }>("channel:message:unpinned", handler),
        ];
        return () => cleanups.forEach(fn => fn());
    }, [channelId, loadPins]);

    async function handleUnpin(messageId: string) {
        if (await unpinMessage(channelId, messageId)) {
            setPins(prev => prev.filter(p => p.messageId !== messageId));
        }
    }

    return (
        <div className="w-72 shrink-0 bg-[#2b2d31] border-l border-black/20 flex flex-col">
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
