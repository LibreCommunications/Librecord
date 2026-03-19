import { useEffect, useRef, useState } from "react";
import { getParticipantTracks } from "../../voice/livekitClient";
import type { VoiceParticipant } from "../../voice/voiceStore";
import { MicOffIcon, HeadphonesOffIcon, CameraIcon, ScreenShareIcon } from "./VoiceIcons";

interface Props {
    participant: VoiceParticipant;
    isSpeaking: boolean;
    getAvatarUrl: (avatarUrl: string | null) => string;
}

export function ParticipantTile({ participant, isSpeaking, getAvatarUrl }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [imgError, setImgError] = useState(false);
    const attachedTrackRef = useRef<MediaStreamTrack | null>(null);

    const showVideo = participant.isCameraOn;

    useEffect(() => {
        if (!showVideo) {
            if (videoRef.current) videoRef.current.srcObject = null;
            attachedTrackRef.current = null;
            return;
        }

        function tryAttach() {
            const { camera } = getParticipantTracks(participant.userId);
            const mediaTrack = camera?.mediaStreamTrack ?? null;

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
    }, [showVideo, participant.userId]);

    const avatarSrc = getAvatarUrl(participant.avatarUrl);

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
                ref={videoRef}
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
