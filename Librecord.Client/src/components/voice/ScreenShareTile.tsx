import { useEffect, useRef, useState, useCallback } from "react";
import { getParticipantTracks } from "../../voice/livekitClient";
import type { VoiceParticipant } from "../../voice/voiceStore";
import { ScreenShareIcon } from "./VoiceIcons";

interface Props {
    participant: VoiceParticipant;
}

export function ScreenShareTile({ participant }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const attachedTrackRef = useRef<MediaStreamTrack | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        function tryAttach() {
            const { screen } = getParticipantTracks(participant.userId);
            const mediaTrack = screen?.mediaStreamTrack ?? null;

            if (mediaTrack && videoRef.current && attachedTrackRef.current !== mediaTrack) {
                videoRef.current.srcObject = new MediaStream([mediaTrack]);
                attachedTrackRef.current = mediaTrack;
            }
        }

        tryAttach();

        // Re-attach whenever a track is subscribed/published for this participant
        const onTrackChanged = (e: Event) => {
            const detail = (e as CustomEvent<{ identity: string }>).detail;
            if (detail?.identity === participant.userId) {
                tryAttach();
            }
        };
        window.addEventListener("voice:track:changed", onTrackChanged);
        return () => window.removeEventListener("voice:track:changed", onTrackChanged);
    }, [participant.userId, participant.isScreenSharing]);

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

            {/* Bottom-right: fullscreen toggle (visible on hover) */}
            <button
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="
                    absolute bottom-2 right-2
                    opacity-0 group-hover/screen:opacity-100
                    transition-opacity
                    p-1.5 rounded-md bg-black/60 backdrop-blur-sm
                    text-white/80 hover:text-white hover:bg-black/80
                "
            >
                {isFullscreen ? (
                    // Minimize icon
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 14 10 14 10 20" />
                        <polyline points="20 10 14 10 14 4" />
                        <line x1="14" y1="10" x2="21" y2="3" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                ) : (
                    // Maximize icon
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                )}
            </button>
        </div>
    );
}
