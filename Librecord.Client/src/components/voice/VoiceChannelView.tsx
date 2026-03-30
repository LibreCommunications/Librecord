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

let _watchingStreams = new Set<string>();

export function VoiceChannelView({ channelId }: Props) {
    const { voiceState } = useVoice();
    const { getAvatarUrl } = useUserProfile();
    const { user } = useAuth();
    const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});
    const [previewParticipants, setPreviewParticipants] = useState<VoiceParticipant[]>([]);

    const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null);
    const [watchingStreams, setWatchingStreams] = useState<Set<string>>(() => _watchingStreams);
    const toggleWatch = useCallback((userId: string, watching: boolean) => {
        setWatchingStreams(() => {
            const next = watching ? new Set([userId]) : new Set<string>();
            _watchingStreams = next;
            return next;
        });
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ identity: string; speaking: boolean }>).detail;
            if (detail) setSpeakingMap(prev => ({ ...prev, [detail.identity]: detail.speaking }));
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
                        userId: p.userId, username: p.username, displayName: p.displayName,
                        avatarUrl: p.avatarUrl, isMuted: p.isMuted, isDeafened: p.isDeafened,
                        isCameraOn: p.isCameraOn, isScreenSharing: p.isScreenSharing, joinedAt: p.joinedAt,
                    })));
                }
            } catch { /* preview is best-effort */ }
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

    // ── Empty ───────────────────────────────────────────────
    if (participants.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#313338]">
                <div className="flex flex-col items-center text-[#949ba4] gap-3">
                    <SpeakerIcon size={48} />
                    <p className="text-lg font-medium">No one is here yet</p>
                    <p className="text-sm text-[#6d6f78]">Click a voice channel to join</p>
                </div>
            </div>
        );
    }

    // Reset focused stream if that user stopped sharing
    if (focusedStreamId && !screenSharers.some(p => p.userId === focusedStreamId)) {
        setFocusedStreamId(null);
    }

    // ── Screen share active ─────────────────────────────────
    if (screenSharers.length > 0) {
        const focused = focusedStreamId ? screenSharers.find(p => p.userId === focusedStreamId) : null;
        const mainStreams = focused ? [focused] : screenSharers;
        const sidebarStreams = focused ? screenSharers.filter(p => p.userId !== focusedStreamId) : [];

        return (
            <div className="flex-1 flex bg-[#313338] overflow-hidden">
                {/* Main area: focused stream or all streams stacked */}
                <div className="flex-1 flex flex-col gap-2 p-3 min-w-0">
                    {mainStreams.map(p => {
                        const isSelf = p.userId === user?.userId;
                        return (
                            <div key={`screen-${p.userId}`} className="relative group/stream flex-1 min-h-0">
                                <ScreenShareTile
                                    participant={p}
                                    isWatching={isSelf || watchingStreams.has(p.userId)}
                                    onToggleWatch={(watching) => toggleWatch(p.userId, watching)}
                                    isSelf={isSelf}
                                />
                                {/* Focus/unfocus button */}
                                {!focused && screenSharers.length > 1 && (
                                    <button
                                        onClick={() => setFocusedStreamId(p.userId)}
                                        className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium opacity-0 group-hover/stream:opacity-100 transition-opacity z-10"
                                    >
                                        Maximize
                                    </button>
                                )}
                                {focused && (
                                    <button
                                        onClick={() => setFocusedStreamId(null)}
                                        className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium opacity-0 group-hover/stream:opacity-100 transition-opacity z-10"
                                    >
                                        Minimize
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right sidebar: other streams (if focused) + all participants */}
                <div className="w-56 shrink-0 bg-[#2b2d31] border-l border-black/20 overflow-y-auto dark-scrollbar p-2 space-y-2">
                    {sidebarStreams.map(p => {
                        const isSelf = p.userId === user?.userId;
                        return (
                            <div
                                key={`side-screen-${p.userId}`}
                                className="cursor-pointer rounded-lg overflow-hidden"
                                onClick={() => setFocusedStreamId(p.userId)}
                            >
                                <ScreenShareTile
                                    participant={p}
                                    isWatching={isSelf || watchingStreams.has(p.userId)}
                                    onToggleWatch={(watching) => toggleWatch(p.userId, watching)}
                                    isSelf={isSelf}
                                />
                            </div>
                        );
                    })}
                    {participants.map(p => (
                        <ParticipantTile
                            key={p.userId}
                            participant={p}
                            isSpeaking={speakingMap[p.userId] ?? false}
                            getAvatarUrl={getAvatarUrl}
                            isSelf={p.userId === user?.userId}
                            compact
                        />
                    ))}
                </div>
            </div>
        );
    }

    // ── No screen shares: centered grid of participant tiles ─
    const count = participants.length;
    const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;

    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden">
            <div className="flex-1 p-6 flex items-center justify-center">
                <div
                    className="grid gap-3 w-full max-w-5xl mx-auto"
                    style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                >
                    {participants.map(p => {
                        if (isInThisChannel) {
                            return (
                                <ParticipantTile
                                    key={p.userId}
                                    participant={p}
                                    isSpeaking={speakingMap[p.userId] ?? false}
                                    getAvatarUrl={getAvatarUrl}
                                    isSelf={p.userId === user?.userId}
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

// ── Preview card for users not in the channel ───────────────

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
        <div className="relative rounded-xl overflow-hidden flex items-center justify-center aspect-video bg-[#2b2d31] ring-1 ring-white/[0.04]">
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
        </div>
    );
}
