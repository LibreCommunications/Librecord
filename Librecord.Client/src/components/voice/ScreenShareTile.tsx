import { useEffect, useRef } from "react";
import { getParticipantTracks } from "../../voice/livekitClient";
import type { VoiceParticipant } from "../../voice/voiceStore";
import { ScreenShareIcon } from "./VoiceIcons";

interface Props {
    participant: VoiceParticipant;
}

export function ScreenShareTile({ participant }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const attachedTrackRef = useRef<MediaStreamTrack | null>(null);

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
        const timer = setTimeout(tryAttach, 300);
        const timer2 = setTimeout(tryAttach, 1000);
        return () => { clearTimeout(timer); clearTimeout(timer2); };
    }, [participant.userId, participant.isScreenSharing]);

    return (
        <div className="relative rounded-xl overflow-hidden bg-[#1e1f22] aspect-video shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
                <span className="text-[#5865f2]"><ScreenShareIcon size={12} /></span>
                <span className="text-xs text-white/90">{participant.displayName}</span>
            </div>
        </div>
    );
}
