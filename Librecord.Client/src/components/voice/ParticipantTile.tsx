import { useEffect, useRef, useState } from "react";
import { Track } from "livekit-client";
import { useTrackBySource } from "../../voice/useTrackBySource";
import type { VoiceParticipant } from "../../voice/voiceStore";
import { MicOffIcon, HeadphonesOffIcon, CameraIcon, ScreenShareIcon } from "./VoiceIcons";

interface Props {
    participant: VoiceParticipant;
    isSpeaking: boolean;
    getAvatarUrl: (avatarUrl: string | null) => string;
    /** Compact mode for the screen-share sidebar strip */
    compact?: boolean;
}

export function ParticipantTile({ participant, isSpeaking, getAvatarUrl, compact }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [imgError, setImgError] = useState(false);

    const showVideo = participant.isCameraOn;

    // Reactive camera track via LiveKit RoomEvents (no polling/custom events)
    const cameraTrack = useTrackBySource(participant.userId, Track.Source.Camera);

    // Attach/detach following @livekit/components-react pattern
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

    // ── COMPACT MODE (screen-share sidebar) ──────────────────────────
    if (compact) {
        return (
            <div
                className={`
                    relative rounded-lg overflow-hidden
                    bg-[#232428] transition-shadow duration-200
                    ${isSpeaking ? "shadow-[0_0_0_2px_#23a55a]" : "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"}
                `}
            >
                {showVideo ? (
                    <div className="aspect-video relative">
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
        );
    }

    // ── FULL MODE (normal grid) ──────────────────────────────────────
    return (
        <div
            className={`
                relative rounded-xl overflow-hidden
                flex items-center justify-center aspect-video
                bg-[#2b2d31] transition-shadow duration-200
                ${isSpeaking ? "shadow-[0_0_0_3px_#23a55a,0_0_12px_rgba(35,165,90,0.3)]" : "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"}
            `}
        >
            <video
                ref={!compact ? videoRef : undefined}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${showVideo ? "" : "hidden"}`}
            />

            {!showVideo && (
                <div className="flex flex-col items-center gap-3">
                    {imgError ? (
                        <div className={`
                            w-[72px] h-[72px] rounded-full bg-[#5865f2]
                            flex items-center justify-center text-2xl text-white font-semibold
                            transition-shadow duration-200
                            ${isSpeaking ? "shadow-[0_0_0_3px_#2b2d31,0_0_0_5px_#23a55a]" : ""}
                        `}>
                            {participant.displayName[0]?.toUpperCase()}
                        </div>
                    ) : (
                        <img
                            src={avatarSrc}
                            alt={participant.displayName}
                            onError={() => setImgError(true)}
                            className={`
                                w-[72px] h-[72px] rounded-full object-cover
                                transition-shadow duration-200
                                ${isSpeaking ? "shadow-[0_0_0_3px_#2b2d31,0_0_0_5px_#23a55a]" : ""}
                            `}
                        />
                    )}
                    <span className="text-sm text-[#b5bac1] font-medium truncate max-w-[80%]">
                        {participant.displayName}
                    </span>
                </div>
            )}

            {/* Status badges */}
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
            </div>
        </div>
    );
}
