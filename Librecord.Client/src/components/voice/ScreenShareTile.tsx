import { useEffect, useRef, useState, useCallback } from "react";
import { getParticipantTracks } from "../../voice/livekitClient";
import type { VoiceParticipant } from "../../voice/voiceStore";
import { ScreenShareIcon } from "./VoiceIcons";

interface Props {
    participant: VoiceParticipant;
    /** Whether the local user has opted into watching this stream. */
    isWatching: boolean;
    /** Toggle watching on/off — state is owned by VoiceChannelView. */
    onToggleWatch: (watching: boolean) => void;
}

export function ScreenShareTile({ participant, isWatching, onToggleWatch }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const attachedTrackRef = useRef<MediaStreamTrack | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!isWatching) {
            if (videoRef.current) videoRef.current.srcObject = null;
            attachedTrackRef.current = null;
            return;
        }

        function tryAttach() {
            const { screen } = getParticipantTracks(participant.userId);
            const mediaTrack = screen?.mediaStreamTrack ?? null;

            if (mediaTrack && videoRef.current && attachedTrackRef.current !== mediaTrack) {
                videoRef.current.srcObject = new MediaStream([mediaTrack]);
                attachedTrackRef.current = mediaTrack;
            }
        }

        tryAttach();

        const onTrackChanged = (e: Event) => {
            const detail = (e as CustomEvent<{ identity: string }>).detail;
            if (detail?.identity === participant.userId) {
                tryAttach();
            }
        };
        window.addEventListener("voice:track:changed", onTrackChanged);
        return () => window.removeEventListener("voice:track:changed", onTrackChanged);
    }, [participant.userId, participant.isScreenSharing, isWatching]);

    // Track fullscreen state changes (user may exit via Escape)
    useEffect(() => {
        function onFullscreenChange() {
            setIsFullscreen(!!document.fullscreenElement);
        }
        document.addEventListener("fullscreenchange", onFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            containerRef.current.requestFullscreen();
        }
    }, []);

    // ── OPT-IN CARD (not watching yet) ───────────────────────────────
    if (!isWatching) {
        return (
            <div
                ref={containerRef}
                className="relative rounded-xl overflow-hidden bg-[#1e1f22] aspect-video flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-[#5865F2]/15">
                        <ScreenShareIcon size={32} />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-[#dbdee1]">
                            {participant.displayName} is sharing their screen
                        </p>
                        <p className="text-xs text-[#949ba4] mt-1">
                            Click below to start watching
                        </p>
                    </div>
                    <button
                        onClick={() => onToggleWatch(true)}
                        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[#5865F2] hover:bg-[#4752C4] transition-colors flex items-center gap-2"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Watch Stream
                    </button>
                </div>
            </div>
        );
    }

    // ── WATCHING ──────────────────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            onDoubleClick={toggleFullscreen}
            className={`
                relative rounded-xl overflow-hidden bg-[#1e1f22]
                shadow-[0_0_0_1px_rgba(255,255,255,0.04)] group/screen
                ${isFullscreen ? "rounded-none" : "aspect-video"}
            `}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full ${isFullscreen ? "object-contain bg-black" : "object-contain"}`}
            />

            {/* Bottom-left: sharer name */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
                <span className="text-[#5865f2]"><ScreenShareIcon size={12} /></span>
                <span className="text-xs text-white/90">{participant.displayName}</span>
            </div>

            {/* Bottom-right: controls (visible on hover) */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover/screen:opacity-100 transition-opacity">
                {/* Stop watching */}
                <button
                    onClick={() => onToggleWatch(false)}
                    title="Stop watching"
                    className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/80"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
                {/* Fullscreen */}
                <button
                    onClick={toggleFullscreen}
                    title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/80"
                >
                    {isFullscreen ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="4 14 10 14 10 20" />
                            <polyline points="20 10 14 10 14 4" />
                            <line x1="14" y1="10" x2="21" y2="3" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
}
