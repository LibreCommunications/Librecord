import { useEffect, useRef, useState } from "react";
import { Track } from "livekit-client";
import { useTrackBySource } from "@librecord/app";
import { getRoom } from "@librecord/app";
import type { VoiceParticipant } from "@librecord/app";
import { ScreenShareIcon } from "./VoiceIcons";
import { PlayIcon, ExitFullscreenIcon, FullscreenIcon, AudioIcon } from "../ui/Icons";
import { DevOverlay } from "./DevOverlay";
import { VolumePopup } from "./VolumePopup";
import { AudioSourcePicker } from "./AudioSourcePicker";
import { useFullscreen } from "./useFullscreen";
import { isDesktop, getElectronAPI, getPipecapAPI } from "@librecord/domain";

const isLinuxDesktop = isDesktop && getElectronAPI()?.platform === "linux" && !!getPipecapAPI();

interface Props {
    participant: VoiceParticipant;
    /** Whether the local user has opted into watching this stream. */
    isWatching: boolean;
    /** Toggle watching on/off — state is owned by VoiceChannelView. */
    onToggleWatch: (watching: boolean) => void;
    /** Whether this is the local user's own screen share. */
    isSelf: boolean;
    /** Fill parent instead of using aspect-video (for constrained containers) */
    fill?: boolean;
}

export function ScreenShareTile({ participant, isWatching, onToggleWatch, isSelf, fill }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { containerRef, isFullscreen, toggleFullscreen } = useFullscreen();
    const [volumePopup, setVolumePopup] = useState<{ x: number; y: number } | null>(null);
    const [showAudioPicker, setShowAudioPicker] = useState(false);

    const track = useTrackBySource(participant.userId, Track.Source.ScreenShare);

    // Subscribe/unsubscribe to save bandwidth when not watching
    useEffect(() => {
        if (isSelf) return;
        const room = getRoom();
        if (!room) return;
        const remote = room.remoteParticipants.get(participant.userId);
        if (!remote) return;
        for (const pub of remote.trackPublications.values()) {
            if (pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio) {
                pub.setSubscribed(isWatching);
            }
        }
    }, [isWatching, participant.userId, isSelf]);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        if (!isWatching || !track) { track?.detach(el); return; }
        track.attach(el);
        return () => { track.detach(el); };
    }, [track, isWatching]);

    const trackStatus: "loading" | "active" = isWatching && track ? "active" : "loading";

    const handleContextMenu = (e: React.MouseEvent) => {
        if (isSelf || !isDesktop) return;
        e.preventDefault();
        setVolumePopup({ x: e.clientX, y: e.clientY });
    };

    if (!isWatching) {
        return (<>
            <div
                ref={containerRef}
                onContextMenu={handleContextMenu}
                className={`relative rounded-xl overflow-hidden bg-[#1e1f22] aspect-video ${fill ? "max-h-full" : ""} flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.04)]`}
            >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 overflow-hidden">
                    <div className="p-3 rounded-full bg-[#5865F2]/15 shrink-0">
                        <ScreenShareIcon size={24} />
                    </div>
                    <p className="text-sm font-medium text-[#dbdee1] truncate w-full text-center">
                        {participant.displayName}&apos;s screen
                    </p>
                    <button
                        onClick={e => { e.stopPropagation(); onToggleWatch(true); }}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-[#5865F2] hover:bg-[#4752c4] transition-colors flex items-center gap-2 shrink-0"
                    >
                        <PlayIcon size={14} />
                        Watch
                    </button>
                </div>
            </div>
            {volumePopup && (
                <VolumePopup userId={`${participant.userId}:screen`} displayName={`${participant.displayName}'s stream`} x={volumePopup.x} y={volumePopup.y} onClose={() => setVolumePopup(null)} />
            )}
        </>);
    }

    return (<>
        <div
            ref={containerRef}
            onDoubleClick={toggleFullscreen}
            onContextMenu={handleContextMenu}
            className={`
                relative rounded-xl overflow-hidden bg-[#1e1f22]
                shadow-[0_0_0_1px_rgba(255,255,255,0.04)] group/screen
                ${isFullscreen ? "rounded-none" : `aspect-video ${fill ? "max-h-full" : ""}`}
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
                    onClick={e => { e.stopPropagation(); onToggleWatch(false); }}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-[#f23f43] hover:text-white hover:bg-[#da373c] text-sm font-bold leading-none z-10 transition-colors"
                    title="Stop watching"
                >
                    ✕
                </button>
            )}

            {trackStatus === "active" && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/screen:opacity-100 transition-opacity">
                    {isSelf && isLinuxDesktop && (
                        <div className="relative">
                            <button
                                onClick={e => { e.stopPropagation(); setShowAudioPicker(!showAudioPicker); }}
                                title="Change audio source"
                                className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/80"
                            >
                                <AudioIcon size={16} />
                            </button>
                            {showAudioPicker && (
                                <AudioSourcePicker onClose={() => setShowAudioPicker(false)} />
                            )}
                        </div>
                    )}
                    <button
                        onClick={e => { e.stopPropagation(); toggleFullscreen(); }}
                        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                        className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/80"
                    >
                        {isFullscreen ? (
                            <ExitFullscreenIcon size={16} />
                        ) : (
                            <FullscreenIcon size={16} />
                        )}
                    </button>
                </div>
            )}
        </div>
        {volumePopup && (
            <VolumePopup userId={`${participant.userId}:screen`} displayName={`${participant.displayName}'s stream`} x={volumePopup.x} y={volumePopup.y} onClose={() => setVolumePopup(null)} />
        )}
    </>);
}
