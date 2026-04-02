import { useState, useEffect, useCallback, useRef } from "react";
import { useVoice } from "@librecord/app";
import { useUserProfile } from "@librecord/app";
import { useAuth } from "@librecord/app";
import { voice } from "@librecord/api-client";
import { ParticipantTile } from "./ParticipantTile";
import { ScreenShareTile } from "./ScreenShareTile";
import { SpeakerIcon } from "./VoiceIcons";
import type { VoiceParticipant } from "@librecord/app";

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

    // One tile maximized at a time (null = default grid view)
    const [maximizedId, setMaximizedId] = useState<string | null>(null);
    const [sidebarWidth, setSidebarWidth] = useState(224); // w-56 = 224px
    const resizing = useRef(false);

    const onResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        resizing.current = true;
        const onMove = (ev: MouseEvent) => {
            if (!resizing.current) return;
            const fromRight = window.innerWidth - ev.clientX;
            setSidebarWidth(Math.max(160, Math.min(480, fromRight)));
        };
        const onUp = () => {
            resizing.current = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, []);
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

    // ── Build all tiles ────────────────────────────────────────
    type Tile = { id: string; type: "screen" | "camera"; participant: VoiceParticipant };
    const allTiles: Tile[] = [];
    for (const p of screenSharers) allTiles.push({ id: `screen:${p.userId}`, type: "screen", participant: p });
    for (const p of participants) allTiles.push({ id: `camera:${p.userId}`, type: "camera", participant: p });

    // Reset if maximized tile no longer exists
    const maximizedTile = maximizedId ? allTiles.find(t => t.id === maximizedId) : null;
    if (maximizedId && !maximizedTile) setMaximizedId(null);

    // ── Maximized view: one tile in main area, rest in sidebar ──
    if (maximizedTile) {
        const sidebarTiles = allTiles.filter(t => t.id !== maximizedId);

        return (
            <div className="flex-1 flex bg-[#313338] overflow-hidden">
                <div className="flex-1 flex flex-col p-3 min-w-0">
                    <div className="relative group/stream flex-1 min-h-0">
                        {maximizedTile.type === "screen" ? (
                            <ScreenShareTile
                                participant={maximizedTile.participant}
                                isWatching={maximizedTile.participant.userId === user?.userId || watchingStreams.has(maximizedTile.participant.userId)}
                                onToggleWatch={(w) => toggleWatch(maximizedTile.participant.userId, w)}
                                isSelf={maximizedTile.participant.userId === user?.userId}
                            />
                        ) : (
                            <ParticipantTile
                                participant={maximizedTile.participant}
                                isSpeaking={speakingMap[maximizedTile.participant.userId] ?? false}
                                getAvatarUrl={getAvatarUrl}
                                isSelf={maximizedTile.participant.userId === user?.userId}
                            />
                        )}
                        <button
                            onClick={e => { e.stopPropagation(); setMaximizedId(null); }}
                            className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium opacity-0 group-hover/stream:opacity-100 transition-opacity z-20"
                        >
                            Minimize
                        </button>
                    </div>
                </div>

                {sidebarTiles.length > 0 && (<>
                    {/* Drag handle */}
                    <div
                        className="w-1 shrink-0 cursor-col-resize hover:bg-[#5865F2]/30 active:bg-[#5865F2]/50 transition-colors"
                        onMouseDown={onResizeStart}
                    />
                    <div className="shrink-0 bg-[#2b2d31] overflow-y-auto dark-scrollbar p-2 space-y-2" style={{ width: sidebarWidth }}>
                        {sidebarTiles.map(t => (
                            <div key={t.id} className="relative group/stream cursor-pointer rounded-lg overflow-hidden"
                                onClick={() => setMaximizedId(t.id)}
                            >
                                {t.type === "screen" ? (
                                    <ScreenShareTile
                                        participant={t.participant}
                                        isWatching={t.participant.userId === user?.userId || watchingStreams.has(t.participant.userId)}
                                        onToggleWatch={(w) => toggleWatch(t.participant.userId, w)}
                                        isSelf={t.participant.userId === user?.userId}
                                    />
                                ) : (
                                    <ParticipantTile
                                        participant={t.participant}
                                        isSpeaking={speakingMap[t.participant.userId] ?? false}
                                        getAvatarUrl={getAvatarUrl}
                                        isSelf={t.participant.userId === user?.userId}
                                        compact
                                    />
                                )}
                                <button
                                    onClick={e => { e.stopPropagation(); setMaximizedId(t.id); }}
                                    className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium opacity-0 group-hover/stream:opacity-100 transition-opacity z-10"
                                >
                                    Maximize
                                </button>
                            </div>
                        ))}
                    </div>
                </>)}
            </div>
        );
    }

    // ── Default: grid of all tiles (screens + participants) ─────
    const cols = allTiles.length <= 1 ? 1 : allTiles.length <= 4 ? 2 : allTiles.length <= 9 ? 3 : 4;

    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden">
            <div className="flex-1 p-3 flex items-center justify-center">
                <div
                    className="grid gap-3 w-full mx-auto"
                    style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                >
                    {allTiles.map(t => (
                        <div key={t.id} className="relative group/stream">
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
                            {isInThisChannel && (
                                <button
                                    onClick={e => { e.stopPropagation(); setMaximizedId(t.id); }}
                                    className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium opacity-0 group-hover/stream:opacity-100 transition-opacity z-20"
                                >
                                    Maximize
                                </button>
                            )}
                        </div>
                    ))}
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
