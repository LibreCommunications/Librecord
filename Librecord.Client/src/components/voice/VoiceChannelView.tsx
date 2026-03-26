import { useState, useEffect, useCallback } from "react";
import { useVoice } from "../../hooks/useVoice";
import { useAuth } from "../../hooks/useAuth";
import { voice } from "../../api/client";
import { ScreenShareTile } from "./ScreenShareTile";
import { SpeakerIcon } from "./VoiceIcons";
import type { VoiceParticipant } from "../../voice/voiceStore";

interface Props {
    channelId: string;
    channelName?: string;
}

export function VoiceChannelView({ channelId }: Props) {
    const { voiceState } = useVoice();
    const { user } = useAuth();

    // Persists across screen share stop/restart so viewers don't need to re-click
    const [watchingStreams, setWatchingStreams] = useState<Set<string>>(new Set());
    const toggleWatch = useCallback((userId: string, watching: boolean) => {
        setWatchingStreams(prev => {
            const next = new Set(prev);
            if (watching) next.add(userId);
            else next.delete(userId);
            return next;
        });
    }, []);

    const isInThisChannel = voiceState.isConnected && voiceState.channelId === channelId;

    const [previewParticipants, setPreviewParticipants] = useState<VoiceParticipant[]>([]);

    useEffect(() => {
        if (isInThisChannel) return;

        let cancelled = false;

        async function fetchParticipants() {
            try {
                const data = await voice.participants(channelId);
                if (!cancelled) {
                    setPreviewParticipants(data.map(p => ({
                        userId: p.userId,
                        username: p.username,
                        displayName: p.displayName,
                        avatarUrl: p.avatarUrl,
                        isMuted: p.isMuted,
                        isDeafened: p.isDeafened,
                        isCameraOn: p.isCameraOn,
                        isScreenSharing: p.isScreenSharing,
                        joinedAt: p.joinedAt,
                    })));
                }
            } catch {
                // Silently fail — preview is best-effort
            }
        }

        fetchParticipants();

        const onVoiceChange = () => { if (!cancelled) fetchParticipants(); };
        window.addEventListener("voice:user:joined", onVoiceChange);
        window.addEventListener("voice:user:left", onVoiceChange);
        return () => {
            cancelled = true;
            window.removeEventListener("voice:user:joined", onVoiceChange);
            window.removeEventListener("voice:user:left", onVoiceChange);
        };
    }, [channelId, isInThisChannel]);

    const participants = isInThisChannel ? voiceState.participants : previewParticipants;
    const screenSharers = isInThisChannel ? participants.filter(p => p.isScreenSharing) : [];
    const hasScreenShare = screenSharers.length > 0;

    if (participants.length === 0) {
        return (
            <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden">
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center text-[#949ba4] gap-3">
                        <SpeakerIcon size={48} />
                        <p className="text-lg font-medium">No one is here yet</p>
                        <p className="text-sm text-[#6d6f78]">Click a voice channel to join</p>
                    </div>
                </div>
            </div>
        );
    }

    if (hasScreenShare) {
        return (
            <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden">
                <div className="flex-1 flex flex-col gap-2 p-3 min-w-0 overflow-auto">
                    {screenSharers.map(p => {
                        const isSelf = p.userId === user?.userId;
                        return (
                            <ScreenShareTile
                                key={`screen-${p.userId}`}
                                participant={p}
                                isWatching={isSelf || watchingStreams.has(p.userId)}
                                onToggleWatch={(watching) => toggleWatch(p.userId, watching)}
                                isSelf={isSelf}
                            />
                        );
                    })}
                </div>
            </div>
        );
    }

    // No screen shares — show empty voice state (participants visible in left sidebar)
    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden">
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center text-[#949ba4] gap-3">
                    <SpeakerIcon size={48} />
                    <p className="text-lg font-medium">Voice Connected</p>
                    <p className="text-sm text-[#6d6f78]">{participants.length} participant{participants.length !== 1 ? "s" : ""} in channel</p>
                </div>
            </div>
        </div>
    );
}
