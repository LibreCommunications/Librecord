import { useEffect, useRef, useState } from "react";
import { Track } from "livekit-client";
import { useTrackBySource } from "@librecord/app";
import type { VoiceParticipant } from "@librecord/app";
import { MicOffIcon, HeadphonesOffIcon, CameraIcon, ScreenShareIcon } from "./VoiceIcons";
import { FullscreenIcon, ExitFullscreenIcon } from "../ui/Icons";
import { VolumePopup } from "./VolumePopup";
import { useFullscreen } from "./useFullscreen";

interface Props {
    participant: VoiceParticipant;
    isSpeaking: boolean;
    getAvatarUrl: (avatarUrl: string | null) => string;
    /** Compact mode for the screen-share sidebar strip */
    compact?: boolean;
    /** Whether this is the local user */
    isSelf?: boolean;
    /** Fill parent instead of using aspect-video (for constrained containers) */
    fill?: boolean;
}

export function ParticipantTile({ participant, isSpeaking, getAvatarUrl, compact, isSelf, fill }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { containerRef, isFullscreen, toggleFullscreen } = useFullscreen();
    const [imgError, setImgError] = useState(false);

    const showVideo = participant.isCameraOn;

    const cameraTrack = useTrackBySource(participant.userId, Track.Source.Camera);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        if (!showVideo || !cameraTrack) {
            cameraTrack?.detach(el);
            return;
        }

        cameraTrack.attach(el);

        return () => {
            cameraTrack.detach(el);
        };
    }, [showVideo, cameraTrack]);

    const avatarSrc = getAvatarUrl(participant.avatarUrl);
    const avatarSize = compact ? 36 : 72;

    const openProfile = () => window.dispatchEvent(new CustomEvent("user:profile:open", { detail: { userId: participant.userId } }));
    const [volumePopup, setVolumePopup] = useState<{ x: number; y: number } | null>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        if (isSelf) return;
        e.preventDefault();
        setVolumePopup({ x: e.clientX, y: e.clientY });
    };

    if (compact) {
        return (<>
            <div
                onClick={openProfile}
                onContextMenu={handleContextMenu}
                className={`
                    relative rounded-lg overflow-hidden cursor-pointer
                    bg-[#232428] transition-all duration-200
                    ${isSpeaking ? "ring-2 ring-[#23a55a]" : "ring-1 ring-white/[0.04]"}
                `}
            >
                {showVideo ? (
                    <div className={`aspect-video ${fill ? "max-h-full min-h-16" : ""} relative`}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1 left-1 flex items-center gap-0.5">
                            <span className="text-[10px] text-white/90 bg-black/50 rounded px-1 py-0.5 backdrop-blur-sm truncate max-w-[100px]">
                                {participant.displayName}
                            </span>
                            {participant.isMuted && (
                                <span className="p-0.5 rounded bg-black/50 backdrop-blur-sm text-red-400">
                                    <MicOffIcon size={10} />
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-2.5 py-2">
                        {imgError ? (
                            <div
                                className={`
                                    rounded-full bg-[#5865f2] flex items-center justify-center
                                    text-sm text-white font-semibold shrink-0
                                    transition-shadow duration-200
                                    ${isSpeaking ? "shadow-[0_0_0_2px_#232428,0_0_0_4px_#23a55a]" : ""}
                                `}
                                style={{ width: avatarSize, height: avatarSize }}
                            >
                                {participant.displayName[0]?.toUpperCase()}
                            </div>
                        ) : (
                            <img
                                src={avatarSrc}
                                alt={participant.displayName}
                                onError={() => setImgError(true)}
                                className={`
                                    rounded-full object-cover shrink-0
                                    transition-shadow duration-200
                                    ${isSpeaking ? "shadow-[0_0_0_2px_#232428,0_0_0_4px_#23a55a]" : ""}
                                `}
                                style={{ width: avatarSize, height: avatarSize }}
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="text-xs text-[#dbdee1] font-medium truncate">
                                {participant.displayName}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                                {participant.isMuted && <span className="text-red-400"><MicOffIcon size={10} /></span>}
                                {participant.isDeafened && <span className="text-red-400"><HeadphonesOffIcon size={10} /></span>}
                                {participant.isScreenSharing && <span className="text-[#5865f2]"><ScreenShareIcon size={10} /></span>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {volumePopup && (
                <VolumePopup userId={participant.userId} displayName={participant.displayName} x={volumePopup.x} y={volumePopup.y} onClose={() => setVolumePopup(null)} />
            )}
        </>);
    }

    return (<>
        <div
            ref={containerRef}
            onClick={openProfile}
            onDoubleClick={e => { e.stopPropagation(); toggleFullscreen(); }}
            onContextMenu={handleContextMenu}
            className={`
                relative rounded-xl cursor-pointer group/tile
                flex items-center justify-center ${isFullscreen ? "" : `aspect-video ${fill ? "max-h-full min-h-16" : ""}`}
                bg-[#2b2d31] transition-all duration-200
                ${isSpeaking ? "ring-[3px] ring-[#23a55a]" : "ring-1 ring-white/[0.04]"}
                ${isFullscreen ? "!rounded-none" : ""}
            `}
        >
            <div className="absolute inset-0 rounded-xl overflow-hidden">
                <video
                    ref={!compact ? videoRef : undefined}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${showVideo ? "" : "hidden"}`}
                />
            </div>

            {!showVideo && (
                <div className="flex flex-col items-center gap-2 overflow-hidden p-2">
                    {imgError ? (
                        <div className={`
                            w-1/4 max-w-[72px] min-w-[32px] aspect-square rounded-full bg-[#5865f2]
                            flex items-center justify-center text-white font-semibold shrink-0
                            transition-shadow duration-200
                            ${isSpeaking ? "shadow-[0_0_0_3px_#2b2d31,0_0_0_5px_#23a55a]" : ""}
                        `}>
                            <span className="text-[clamp(0.75rem,3cqw,1.5rem)]">{participant.displayName[0]?.toUpperCase()}</span>
                        </div>
                    ) : (
                        <img
                            src={avatarSrc}
                            alt={participant.displayName}
                            onError={() => setImgError(true)}
                            className={`
                                w-1/4 max-w-[72px] min-w-[32px] aspect-square rounded-full object-cover shrink-0
                                transition-shadow duration-200
                                ${isSpeaking ? "shadow-[0_0_0_3px_#2b2d31,0_0_0_5px_#23a55a]" : ""}
                            `}
                        />
                    )}
                    <span className="text-sm text-[#b5bac1] font-medium truncate max-w-full">
                        {participant.displayName}
                    </span>
                </div>
            )}

            <div className="absolute bottom-2 left-2 flex items-center gap-1">
                {showVideo && (
                    <span className="text-xs text-white/90 bg-black/50 rounded px-1.5 py-0.5 backdrop-blur-sm truncate max-w-[120px]">
                        {participant.displayName}
                    </span>
                )}
                {participant.isMuted && (
                    <span className="p-1 rounded bg-black/50 backdrop-blur-sm text-red-400">
                        <MicOffIcon size={12} />
                    </span>
                )}
                {participant.isDeafened && (
                    <span className="p-1 rounded bg-black/50 backdrop-blur-sm text-red-400">
                        <HeadphonesOffIcon size={12} />
                    </span>
                )}
            </div>

            <div className="absolute bottom-2 right-2 flex items-center gap-1">
                {participant.isCameraOn && (
                    <span className="p-1 rounded bg-black/50 backdrop-blur-sm text-white/80">
                        <CameraIcon size={12} />
                    </span>
                )}
                {participant.isScreenSharing && (
                    <span className="p-1 rounded bg-black/50 backdrop-blur-sm text-[#5865f2]">
                        <ScreenShareIcon size={12} />
                    </span>
                )}
                <button
                    onClick={e => { e.stopPropagation(); toggleFullscreen(); }}
                    title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    className="p-1 rounded bg-black/50 backdrop-blur-sm text-white/60 hover:text-white opacity-0 group-hover/tile:opacity-100 transition-opacity"
                >
                    {isFullscreen ? <ExitFullscreenIcon size={12} /> : <FullscreenIcon size={12} />}
                </button>
            </div>
        </div>
        {volumePopup && (
            <VolumePopup userId={participant.userId} displayName={participant.displayName} x={volumePopup.x} y={volumePopup.y} onClose={() => setVolumePopup(null)} />
        )}
    </>);
}
