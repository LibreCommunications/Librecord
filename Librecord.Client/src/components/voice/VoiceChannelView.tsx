import { useState, useEffect } from "react";
import { useVoice } from "../../hooks/useVoice";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useAuth } from "../../hooks/useAuth";
import { fetchWithAuth } from "../../api/fetchWithAuth";
import { ParticipantTile } from "./ParticipantTile";
import { ScreenShareTile } from "./ScreenShareTile";
import { SpeakerIcon } from "./VoiceIcons";
import type { VoiceParticipant } from "../../voice/voiceStore";

const API_URL = import.meta.env.VITE_API_URL;

interface VoiceParticipantPayload {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isMuted: boolean;
    isDeafened: boolean;
    isCameraOn: boolean;
    isScreenSharing: boolean;
    joinedAt: string;
}

interface Props {
    channelId: string;
    channelName?: string;
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

            {/* Status badges */}
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

/* ------------------------------------------------------------------ */
/* GRID COLUMNS — adapts to participant count                          */
/* ------------------------------------------------------------------ */
function getGridClass(count: number): string {
    if (count <= 1) return "grid-cols-1 max-w-lg mx-auto";
    if (count <= 2) return "grid-cols-2 max-w-3xl mx-auto";
    if (count <= 4) return "grid-cols-2 max-w-4xl mx-auto";
    if (count <= 9) return "grid-cols-3 max-w-5xl mx-auto";
    return "grid-cols-4 max-w-6xl mx-auto";
}

/* ------------------------------------------------------------------ */
/* MAIN VIEW                                                           */
/* ------------------------------------------------------------------ */
export function VoiceChannelView({ channelId }: Props) {
    const { voiceState } = useVoice();
    const { getAvatarUrl } = useUserProfile();
    const auth = useAuth();
    const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});
    const [previewParticipants, setPreviewParticipants] = useState<VoiceParticipant[]>([]);

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

    // When not connected to this channel, fetch participants from the API
    // so users can see who's in the call before joining.
    const isInThisChannel = voiceState.isConnected && voiceState.channelId === channelId;

    useEffect(() => {
        if (isInThisChannel) return;

        let cancelled = false;

        async function fetchParticipants() {
            try {
                const res = await fetchWithAuth(
                    `${API_URL}/voice/channels/${channelId}/participants`,
                    {},
                    auth,
                );
                if (!res.ok || cancelled) return;
                const data: VoiceParticipantPayload[] = await res.json();
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

        // Refresh when voice events arrive (someone joins/leaves)
        const onVoiceChange = () => { if (!cancelled) fetchParticipants(); };
        window.addEventListener("voice:user:joined", onVoiceChange);
        window.addEventListener("voice:user:left", onVoiceChange);
        return () => {
            cancelled = true;
            window.removeEventListener("voice:user:joined", onVoiceChange);
            window.removeEventListener("voice:user:left", onVoiceChange);
        };
    }, [channelId, isInThisChannel, auth]);

    // When connected to this channel, use live state; otherwise use API preview
    const participants = isInThisChannel ? voiceState.participants : previewParticipants;
    const screenSharers = participants.filter(p => p.isScreenSharing);
    const totalTiles = participants.length + (isInThisChannel ? screenSharers.length : 0);

    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden">
            <div className="flex-1 p-6 overflow-auto flex items-center">
                {participants.length === 0 && (
                    <div className="flex flex-col items-center justify-center w-full text-[#949ba4] gap-3">
                        <SpeakerIcon size={48} />
                        <p className="text-lg font-medium">No one is here yet</p>
                        <p className="text-sm text-[#6d6f78]">Click a voice channel to join</p>
                    </div>
                )}

                {participants.length > 0 && (
                    <div className={`grid ${getGridClass(totalTiles)} gap-3 w-full`}>
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
