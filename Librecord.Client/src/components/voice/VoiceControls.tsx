import { useState } from "react";
import { useVoice } from "../../hooks/useVoice";
import {
    MicIcon, MicOffIcon,
    HeadphonesIcon, HeadphonesOffIcon,
    CameraIcon, ScreenShareIcon, PhoneOffIcon,
} from "./VoiceIcons";
import { ScreenShareModal, type ScreenShareOptions } from "./ScreenShareModal";

export function VoiceControls() {
    const {
        voiceState,
        leaveVoice,
        toggleMute,
        toggleDeafen,
        toggleCamera,
        startScreenShare,
        stopScreenShare,
    } = useVoice();

    const [showScreenShareModal, setShowScreenShareModal] = useState(false);

    if (!voiceState.isConnected) return null;

    function handleScreenShareClick() {
        if (voiceState.isScreenSharing) {
            stopScreenShare();
        } else {
            setShowScreenShareModal(true);
        }
    }

    function handleScreenShareStart(options: ScreenShareOptions) {
        setShowScreenShareModal(false);
        startScreenShare(options);
    }

    return (
        <>
            <div className="bg-[#232428] border-t border-black/30 px-3 py-2">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-green-400 font-medium">Voice Connected</span>
                </div>

                <div className="flex items-center gap-1">
                    <ControlButton
                        active={!voiceState.isMuted}
                        activeColor="text-white"
                        inactiveColor="text-red-400 bg-red-400/10"
                        onClick={toggleMute}
                        title={voiceState.isMuted ? "Unmute" : "Mute"}
                    >
                        {voiceState.isMuted ? <MicOffIcon /> : <MicIcon />}
                    </ControlButton>

                    <ControlButton
                        active={!voiceState.isDeafened}
                        activeColor="text-white"
                        inactiveColor="text-red-400 bg-red-400/10"
                        onClick={toggleDeafen}
                        title={voiceState.isDeafened ? "Undeafen" : "Deafen"}
                    >
                        {voiceState.isDeafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}
                    </ControlButton>

                    <ControlButton
                        active={voiceState.isCameraOn}
                        activeColor="text-white bg-white/10"
                        inactiveColor="text-gray-400"
                        onClick={toggleCamera}
                        title={voiceState.isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
                    >
                        <CameraIcon />
                    </ControlButton>

                    <ControlButton
                        active={voiceState.isScreenSharing}
                        activeColor="text-white bg-white/10"
                        inactiveColor="text-gray-400"
                        onClick={handleScreenShareClick}
                        title={voiceState.isScreenSharing ? "Stop Sharing" : "Share Screen"}
                    >
                        <ScreenShareIcon />
                    </ControlButton>

                    <button
                        onClick={leaveVoice}
                        className="ml-auto p-2 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300"
                        title="Disconnect"
                    >
                        <PhoneOffIcon />
                    </button>
                </div>
            </div>

            <ScreenShareModal
                open={showScreenShareModal}
                onStart={handleScreenShareStart}
                onCancel={() => setShowScreenShareModal(false)}
            />
        </>
    );
}

function ControlButton({
    active,
    activeColor,
    inactiveColor,
    onClick,
    title,
    children,
}: {
    active: boolean;
    activeColor: string;
    inactiveColor: string;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`p-2 rounded hover:bg-white/10 ${active ? activeColor : inactiveColor}`}
        >
            {children}
        </button>
    );
}
