import { useState, useEffect } from "react";
import { useVoice } from "../../hooks/useVoice";
import { useUserProfile } from "../../hooks/useUserProfile";
import { ParticipantTile } from "./ParticipantTile";
import { ScreenShareTile } from "./ScreenShareTile";
import { SpeakerIcon } from "./VoiceIcons";
import type { VoiceParticipant } from "../../voice/voiceStore";

interface Props {
    channelId: string;
    channelName?: string;
}

/* ------------------------------------------------------------------ */
/* DETERMINISTIC TILE COLORS                                           */
/* ------------------------------------------------------------------ */
const TILE_COLORS = [
    "#e8b4cb", "#c4b8a8", "#d5cfc4", "#7b5e7b",
    "#a8c4b8", "#b8a8c4", "#c4a8a8", "#a8b8c4",
    "#c9b1d0", "#b1c9b8", "#d4c4a8", "#a8c4c9",
];

function getUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}

/* ------------------------------------------------------------------ */
/* PREVIEW CARD (not connected — shows who's in the channel)           */
/* ------------------------------------------------------------------ */
function PreviewCard({
    participant,
    getAvatarUrl,
}: {
    participant: VoiceParticipant;
    getAvatarUrl: (url: string | null) => string;
}) {
    const bg = getUserColor(participant.userId);
    const [imgError, setImgError] = useState(false);
    const avatarSrc = getAvatarUrl(participant.avatarUrl);

    return (
        <div
            className="relative rounded-lg overflow-hidden flex items-center justify-center aspect-video"
            style={{ backgroundColor: bg }}
        >
            {imgError ? (
                <div className="w-20 h-20 rounded-full bg-[#5865F2] flex items-center justify-center text-3xl text-white font-medium">
                    {participant.displayName[0]?.toUpperCase()}
                </div>
            ) : (
                <img
                    src={avatarSrc}
                    alt={participant.displayName}
                    onError={() => setImgError(true)}
                    className="w-20 h-20 rounded-full object-cover"
                />
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-1.5 flex items-center gap-2">
                <span className="text-sm text-white truncate flex-1">
                    {participant.displayName}
                </span>
                {participant.isMuted && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.34 2.18" />
                    </svg>
                )}
                {participant.isDeafened && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                )}
                {participant.isScreenSharing && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 shrink-0">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                )}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* MAIN VIEW                                                           */
/* ------------------------------------------------------------------ */
export function VoiceChannelView({ channelId }: Props) {
    const { voiceState } = useVoice();
    const { getAvatarUrl } = useUserProfile();
    const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});

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
    const participants = voiceState.participants;
    const screenSharers = participants.filter(p => p.isScreenSharing);

    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden">
            <div className="flex-1 p-4 overflow-auto">
                {participants.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                        <SpeakerIcon size={48} />
                        <p className="text-lg">No one is in this channel yet</p>
                        <p className="text-sm text-gray-500">Click a voice channel in the sidebar to join</p>
                    </div>
                )}

                {participants.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 auto-rows-min">
                        {isInThisChannel && screenSharers.map(p => (
                            <ScreenShareTile key={`screen-${p.userId}`} participant={p} />
                        ))}

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
                )}
            </div>
        </div>
    );
}
