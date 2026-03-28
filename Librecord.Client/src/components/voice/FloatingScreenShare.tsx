import { useEffect, useRef, useState } from "react";
import { Track } from "livekit-client";
import { getRoom } from "../../voice/livekitClient";
import { getVoiceState } from "../../voice/voiceStore";
import { useLocation, useNavigate } from "react-router-dom";

export function FloatingScreenShare() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [visible, setVisible] = useState(false);
    const [sharerName, setSharerName] = useState("");
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const interval = setInterval(() => {
            const room = getRoom();
            const voice = getVoiceState();
            if (!room || !voice.isConnected) { setVisible(false); return; }

            // Check if we're currently viewing the voice channel
            const onVoicePage = voice.channelId && location.pathname.includes(voice.channelId);
            if (onVoicePage) { setVisible(false); return; }

            // Find any remote screenshare track
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let screenTrack: any = null;
            let name = "";
            for (const p of room.remoteParticipants.values()) {
                for (const pub of p.trackPublications.values()) {
                    if (pub.source === Track.Source.ScreenShare && pub.track) {
                        screenTrack = pub.track;
                        name = p.name || p.identity.slice(0, 12);
                        break;
                    }
                }
                if (screenTrack) break;
            }

            if (!screenTrack) { setVisible(false); return; }

            setSharerName(name);
            setVisible(true);

            const el = videoRef.current;
            if (el && screenTrack) {
                screenTrack.attach(el);
            }
        }, 1000);

        const el = videoRef.current;
        return () => {
            clearInterval(interval);
            if (el) el.srcObject = null;
        };
    }, [location.pathname]);

    if (!visible) return null;

    const voice = getVoiceState();
    const voiceUrl = voice.guildId && voice.channelId
        ? `/app/guild/${voice.guildId}/${voice.channelId}`
        : null;

    return (
        <div
            className="fixed bottom-16 right-4 z-[90] w-80 rounded-lg overflow-hidden shadow-2xl border border-[#1e1f22] bg-black cursor-pointer group"
            onClick={() => { if (voiceUrl) navigate(voiceUrl); }}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-contain bg-black"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-white font-medium truncate">{sharerName}'s screen</span>
                <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 transition-opacity">Click to return</span>
            </div>
        </div>
    );
}
