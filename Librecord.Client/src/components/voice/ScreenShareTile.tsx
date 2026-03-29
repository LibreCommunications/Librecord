import { useEffect, useRef, useState, useCallback } from "react";
import { Track } from "livekit-client";
import { useTrackBySource } from "../../voice/useTrackBySource";
import { getRoom } from "../../voice/livekitClient";
import type { VoiceParticipant } from "../../voice/voiceStore";
import { ScreenShareIcon } from "./VoiceIcons";
import { DevOverlay } from "./DevOverlay";

interface Props {
    participant: VoiceParticipant;
    /** Whether the local user has opted into watching this stream. */
    isWatching: boolean;
    /** Toggle watching on/off — state is owned by VoiceChannelView. */
    onToggleWatch: (watching: boolean) => void;
    /** Whether this is the local user's own screen share. */
    isSelf: boolean;
}

export function ScreenShareTile({ participant, isWatching, onToggleWatch, isSelf }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const track = useTrackBySource(participant.userId, Track.Source.ScreenShare);

    // Subscribe/unsubscribe to save bandwidth when not watching
    useEffect(() => {
        if (isSelf) return; // don't unsubscribe from own stream
        const room = getRoom();
        if (!room) return;
        const remote = room.remoteParticipants.get(participant.userId);
        if (!remote) return;
        for (const pub of remote.trackPublications.values()) {
            if (pub.source === Track.Source.ScreenShare) {
                pub.setSubscribed(isWatching);
            }
        }
    }, [isWatching, participant.userId, isSelf]);

    // attach() / detach() following @livekit/components-react pattern.
    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        if (!isWatching || !track) {
            track?.detach(el);
            return;
        }

        track.attach(el);

        return () => {
            track.detach(el);
        };
    }, [track, isWatching]);

    const trackStatus: "loading" | "active" =
        isWatching && track ? "active" : "loading";

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
                        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[#5865F2] hover:bg-[#4752c4] transition-colors flex items-center gap-2"
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
            {trackStatus === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-[#949ba4]">Connecting to stream...</span>
                    </div>
                </div>
            )}

            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full ${isFullscreen ? "object-contain bg-black" : "object-contain"}`}
            />

            {isFullscreen && <DevOverlay embedded />}

            {trackStatus === "active" && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
                    <span className="text-[#5865f2]"><ScreenShareIcon size={12} /></span>
                    <span className="text-xs text-white/90">{participant.displayName}</span>
                </div>
            )}

            {trackStatus === "active" && !isSelf && (
                <button
                    onClick={() => onToggleWatch(false)}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-[#f23f43] hover:text-white hover:bg-[#da373c] text-sm font-bold leading-none z-10 transition-colors"
                    title="Stop watching"
                >
                    ✕
                </button>
            )}

            {trackStatus === "active" && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/screen:opacity-100 transition-opacity">
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
            )}
        </div>
    );
}
