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

// Persists across unmount/remount so "watching" status survives navigation
let _watchingStreams = new Set<string>();

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

const EXPAND_ICON = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
    </svg>
);
const SHRINK_ICON = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
        <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
    </svg>
);

function FocusOverlay({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <div
            className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium cursor-pointer opacity-0 group-hover/tile:opacity-100 transition-opacity z-10 flex items-center gap-1"
            onClick={e => { e.stopPropagation(); onClick(); }}
        >
            {label === "Focus" ? EXPAND_ICON : SHRINK_ICON}
            {label}
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

    // Module-level so it survives unmount/remount when navigating away and back
    // { type: "screen" | "camera", userId } or null
    const [focusedTile, setFocusedTile] = useState<{ type: "screen" | "camera"; userId: string } | null>(null);
    const [watchingStreams, setWatchingStreams] = useState<Set<string>>(() => _watchingStreams);
    const toggleWatch = useCallback((userId: string, watching: boolean) => {
        setWatchingStreams(prev => {
            const next = new Set(prev);
            if (watching) next.add(userId);
            else next.delete(userId);
            _watchingStreams = next;
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

    // ── Build tile list ────────────────────────────────────────
    // Each tile is either a screen share or a participant card
    type Tile = { key: string; type: "screen"; participant: VoiceParticipant }
              | { key: string; type: "camera"; participant: VoiceParticipant };

    const tiles: Tile[] = [];
    if (hasScreenShare) {
        for (const p of screenSharers) tiles.push({ key: `screen-${p.userId}`, type: "screen", participant: p });
    }
    for (const p of participants) tiles.push({ key: `user-${p.userId}`, type: "camera", participant: p });

    // ── Focused mode ────────────────────────────────────────
    const focusedP = focusedTile
        ? tiles.find(t => t.type === focusedTile.type && t.participant.userId === focusedTile.userId)
        : null;

    if (focusedP) {
        const remaining = tiles.filter(t => t !== focusedP);

        return (
            <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden">
                {/* Focused tile — top */}
                <div className="p-3 pb-0 relative group/focused" style={{ flex: 3 }}>
                    <div className="h-full">
                        {focusedP.type === "screen" ? (
                            <ScreenShareTile
                                participant={focusedP.participant}
                                isWatching={focusedP.participant.userId === user?.userId || watchingStreams.has(focusedP.participant.userId)}
                                onToggleWatch={(w) => toggleWatch(focusedP.participant.userId, w)}
                                isSelf={focusedP.participant.userId === user?.userId}
                                fill
                            />
                        ) : (
                            <ParticipantTile
                                participant={focusedP.participant}
                                isSpeaking={speakingMap[focusedP.participant.userId] ?? false}
                                getAvatarUrl={getAvatarUrl}
                                isSelf={focusedP.participant.userId === user?.userId}
                                fill
                            />
                        )}
                    </div>
                    {/* Minimize overlay */}
                    <div className="absolute inset-3 bottom-0 rounded-xl pointer-events-none flex items-start justify-center">
                        <div className="mt-2 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-medium flex items-center gap-1.5 opacity-0 group-hover/focused:opacity-100 transition-opacity pointer-events-auto cursor-pointer" onClick={() => setFocusedTile(null)}>
                            {SHRINK_ICON}
                            Minimize
                        </div>
                    </div>
                </div>

                {/* Remaining — bottom row */}
                <div className="p-3 pt-1.5 overflow-hidden" style={{ flex: 1 }}>
                    <div className="h-full flex gap-2">
                        {remaining.map(t => {
                            const isUnwatchedScreen = t.type === "screen" && t.participant.userId !== user?.userId && !watchingStreams.has(t.participant.userId);
                            return (
                                <div
                                    key={t.key}
                                    className={`relative group/tile overflow-hidden rounded-lg flex-1 min-w-0 ${isUnwatchedScreen ? "cursor-pointer" : ""}`}
                                    onClick={isUnwatchedScreen ? () => {
                                        toggleWatch(t.participant.userId, true);
                                        setFocusedTile({ type: "screen", userId: t.participant.userId });
                                    } : undefined}
                                >
                                    {t.type === "screen" ? (
                                        <ScreenShareTile
                                            participant={t.participant}
                                            isWatching={t.participant.userId === user?.userId || watchingStreams.has(t.participant.userId)}
                                            onToggleWatch={(w) => toggleWatch(t.participant.userId, w)}
                                            isSelf={t.participant.userId === user?.userId}
                                            fill
                                        />
                                    ) : (
                                        <ParticipantTile
                                            participant={t.participant}
                                            isSpeaking={speakingMap[t.participant.userId] ?? false}
                                            getAvatarUrl={getAvatarUrl}
                                            isSelf={t.participant.userId === user?.userId}
                                            fill
                                        />
                                    )}
                                    {!isUnwatchedScreen && (
                                        <FocusOverlay label="Focus" onClick={() => setFocusedTile({ type: t.type, userId: t.participant.userId })} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // ── Normal grid — all tiles equal ───────────────────────
    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden relative">
            <div className="flex-1 p-3 overflow-auto flex items-center justify-center">
                <div className={`grid ${getGridClass(tiles.length)} gap-3 w-full mx-auto`}>
                    {tiles.map(t => {
                        const isUnwatchedScreen = t.type === "screen" && t.participant.userId !== user?.userId && !watchingStreams.has(t.participant.userId);
                        return (
                            <div key={t.key} className="relative group/tile">
                                {t.type === "screen" ? (
                                    <ScreenShareTile
                                        participant={t.participant}
                                        isWatching={t.participant.userId === user?.userId || watchingStreams.has(t.participant.userId)}
                                        onToggleWatch={(w) => toggleWatch(t.participant.userId, w)}
                                        isSelf={t.participant.userId === user?.userId}
                                    />
                                ) : isInThisChannel ? (
                                    <ParticipantTile
                                        participant={t.participant}
                                        isSpeaking={speakingMap[t.participant.userId] ?? false}
                                        getAvatarUrl={getAvatarUrl}
                                        isSelf={t.participant.userId === user?.userId}
                                    />
                                ) : (
                                    <PreviewCard participant={t.participant} getAvatarUrl={getAvatarUrl} />
                                )}
                                {isInThisChannel && !isUnwatchedScreen && (
                                    <FocusOverlay label="Focus" onClick={() => setFocusedTile({ type: t.type, userId: t.participant.userId })} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
