import { useEffect, useRef, useState } from "react";
import { getParticipantTracks } from "../../voice/livekitClient";
import type { VoiceParticipant } from "../../voice/voiceStore";
import { MicOffIcon, HeadphonesOffIcon, CameraIcon, ScreenShareIcon } from "./VoiceIcons";

interface Props {
    participant: VoiceParticipant;
    isSpeaking: boolean;
    getAvatarUrl: (avatarUrl: string | null) => string;
}

const TILE_COLORS = [
    "#e8b4cb", "#c4b8a8", "#d5cfc4", "#7b5e7b",
    "#a8c4b8", "#b8a8c4", "#c4a8a8", "#a8b8c4",
    "#c9b1d0", "#b1c9b8", "#d4c4a8", "#a8c4c9",
];

function getUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}

export function ParticipantTile({ participant, isSpeaking, getAvatarUrl }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [imgError, setImgError] = useState(false);
    const attachedTrackRef = useRef<MediaStreamTrack | null>(null);
    const bg = getUserColor(participant.userId);

    const showVideo = participant.isCameraOn;

    // Attach camera track when camera is on, detach when off
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

        // Brief retry in case track isn't published yet
        const timer = setTimeout(tryAttach, 300);
        const timer2 = setTimeout(tryAttach, 1000);
        return () => { clearTimeout(timer); clearTimeout(timer2); };
    }, [showVideo, participant.userId]);

    const avatarSrc = getAvatarUrl(participant.avatarUrl);

    return (
        <div
            className={`
                relative rounded-lg overflow-hidden
                flex items-center justify-center aspect-video
                ${isSpeaking ? "ring-2 ring-green-500" : ""}
            `}
            style={{ backgroundColor: showVideo ? "#1e1f22" : bg }}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${showVideo ? "" : "hidden"}`}
            />

            {!showVideo && (
                imgError ? (
                    <div className={`w-20 h-20 rounded-full bg-[#5865F2] flex items-center justify-center text-3xl text-white font-medium ${isSpeaking ? "ring-3 ring-green-500" : ""}`}>
                        {participant.displayName[0]?.toUpperCase()}
                    </div>
                ) : (
                    <img
                        src={avatarSrc}
                        alt={participant.displayName}
                        onError={() => setImgError(true)}
                        className={`w-20 h-20 rounded-full object-cover ${isSpeaking ? "ring-3 ring-green-500" : ""}`}
                    />
                )
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-1.5 flex items-center gap-2 z-10">
                <span className="text-sm text-white truncate flex-1">
                    {participant.displayName}
                </span>
                {participant.isMuted && <span className="text-red-400" title="Muted"><MicOffIcon size={14} /></span>}
                {participant.isDeafened && <span className="text-red-400" title="Deafened"><HeadphonesOffIcon size={14} /></span>}
                {participant.isCameraOn && <span className="text-green-400" title="Camera On"><CameraIcon size={14} /></span>}
                {participant.isScreenSharing && <span className="text-blue-400" title="Screen Sharing"><ScreenShareIcon size={14} /></span>}
            </div>
        </div>
    );
}
