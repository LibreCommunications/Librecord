import { useState, useEffect, useCallback } from "react";
import { useVoice } from "../../hooks/useVoice";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useAuth } from "../../hooks/useAuth";
import { voice } from "../../api/client";
import { ParticipantTile } from "./ParticipantTile";
import { ScreenShareTile } from "./ScreenShareTile";
import { SpeakerIcon } from "./VoiceIcons";
import type { VoiceParticipant } from "../../voice/voiceStore";

interface Props {
    channelId: string;
    channelName?: string;
}

function PreviewCard({
    participant,
    getAvatarUrl,
}: {
    participant: VoiceParticipant;
    getAvatarUrl: (url: string | null) => string;
}) {
    const [imgError, setImgError] = useState(false);
    const avatarSrc = getAvatarUrl(participant.avatarUrl);

    return (
        <div className="relative rounded-xl overflow-hidden flex items-center justify-center aspect-video bg-[#2b2d31] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <div className="flex flex-col items-center gap-3">
                {imgError ? (
                    <div className="w-[72px] h-[72px] rounded-full bg-[#5865f2] flex items-center justify-center text-2xl text-white font-semibold">
                        {participant.displayName[0]?.toUpperCase()}
                    </div>
                ) : (
                    <img
                        src={avatarSrc}
                        alt={participant.displayName}
                        onError={() => setImgError(true)}
                        className="w-[72px] h-[72px] rounded-full object-cover"
                    />
                )}
                <span className="text-sm text-[#b5bac1] font-medium truncate max-w-[80%]">
                    {participant.displayName}
                </span>
            </div>

            <div className="absolute bottom-2 left-2 flex items-center gap-1">
                {participant.isMuted && (
                    <span className="p-1 rounded bg-black/40 text-red-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="1" y1="1" x2="23" y2="23" />
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.34 2.18" />
                        </svg>
                    </span>
                )}
                {participant.isDeafened && (
                    <span className="p-1 rounded bg-black/40 text-red-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                    </span>
                )}
                {participant.isScreenSharing && (
                    <span className="p-1 rounded bg-black/40 text-[#5865f2]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                    </span>
                )}
            </div>
        </div>
    );
}

function getGridClass(count: number): string {
    if (count <= 1) return "grid-cols-1 max-w-lg";
    if (count <= 2) return "grid-cols-2 max-w-3xl";
    if (count <= 4) return "grid-cols-2 max-w-4xl";
    if (count <= 9) return "grid-cols-3 max-w-5xl";
    return "grid-cols-4 max-w-6xl";
}

export function VoiceChannelView({ channelId }: Props) {
    const { voiceState } = useVoice();
    const { getAvatarUrl } = useUserProfile();
    const { user } = useAuth();
    const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});
    const [previewParticipants, setPreviewParticipants] = useState<VoiceParticipant[]>([]);

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

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ identity: string; speaking: boolean }>).detail;
            if (detail) {
                setSpeakingMap(prev => ({ ...prev, [detail.identity]: detail.speaking }));
            }
        };
        window.addEventListener("voice:speaking:changed", handler);
        return () => window.removeEventListener("voice:speaking:changed", handler);
    }, []);

    const isInThisChannel = voiceState.isConnected && voiceState.channelId === channelId;

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
            <div className="flex-1 flex bg-[#313338] overflow-hidden">
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

                <div className="w-56 shrink-0 bg-[#2b2d31] border-l border-black/20 overflow-y-auto dark-scrollbar p-2 space-y-2">
                    {participants.map(p => (
                        <ParticipantTile
                            key={p.userId}
                            participant={p}
                            isSpeaking={speakingMap[p.userId] ?? false}
                            getAvatarUrl={getAvatarUrl}
                            compact
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden relative">
            <div className="flex-1 p-6 overflow-auto flex items-center justify-center">
                <div className={`grid ${getGridClass(participants.length)} gap-3 w-full mx-auto`}>
                    {participants.map(p => {
                        if (isInThisChannel) {
                            return (
                                <ParticipantTile
                                    key={p.userId}
                                    participant={p}
                                    isSpeaking={speakingMap[p.userId] ?? false}
                                    getAvatarUrl={getAvatarUrl}
                                />
                            );
                        }

                        return (
                            <PreviewCard
                                key={p.userId}
                                participant={p}
                                getAvatarUrl={getAvatarUrl}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
