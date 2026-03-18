import { useEffect, useRef } from "react";
import { getParticipantTracks } from "../../voice/livekitClient";
import type { VoiceParticipant } from "../../voice/voiceStore";

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
        <div className="relative rounded-lg overflow-hidden bg-[#1e1f22] aspect-video">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain bg-black"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1.5">
                <span className="text-sm text-white">
                    {participant.displayName}'s screen
                </span>
            </div>
        </div>
    );
}
