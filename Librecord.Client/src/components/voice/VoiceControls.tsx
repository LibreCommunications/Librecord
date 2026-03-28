import { useEffect, useRef, useState } from "react";
import { useVoice } from "../../hooks/useVoice";
import {
    MicIcon, MicOffIcon,
    HeadphonesIcon, HeadphonesOffIcon,
    CameraIcon, ScreenShareIcon, PhoneOffIcon,
} from "./VoiceIcons";
import { ScreenShareModal, type ScreenShareOptions } from "./ScreenShareModal";
import * as livekitClient from "../../voice/livekitClient";

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
    const [showCameraMenu, setShowCameraMenu] = useState(false);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const cameraMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showCameraMenu) return;
        livekitClient.listVideoDevices().then(setVideoDevices);
        function onClick(e: MouseEvent) {
            if (cameraMenuRef.current && !cameraMenuRef.current.contains(e.target as Node)) {
                setShowCameraMenu(false);
            }
        }
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [showCameraMenu]);

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

                    <div className="relative" ref={cameraMenuRef}>
                        <ControlButton
                            active={voiceState.isCameraOn}
                            activeColor="text-white bg-white/10"
                            inactiveColor="text-gray-400"
                            onClick={toggleCamera}
                            onContextMenu={e => { e.preventDefault(); setShowCameraMenu(!showCameraMenu); }}
                            title={voiceState.isCameraOn ? "Turn Off Camera" : "Turn On Camera (right-click to select)"}
                        >
                            <CameraIcon />
                        </ControlButton>
                        {showCameraMenu && videoDevices.length > 0 && (
                            <div className="absolute bottom-full left-0 mb-2 bg-[#111214] border border-[#2b2d31] rounded-lg shadow-lg py-1 min-w-[200px] z-50">
                                {videoDevices.map(d => (
                                    <button
                                        key={d.deviceId}
                                        onClick={() => {
                                            livekitClient.switchCamera(d.deviceId);
                                            setShowCameraMenu(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-sm text-[#dbdee1] hover:bg-white/10 truncate"
                                    >
                                        {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

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
    onContextMenu,
    title,
    children,
}: {
    active: boolean;
    activeColor: string;
    inactiveColor: string;
    onClick: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            onContextMenu={onContextMenu}
            title={title}
            className={`p-2 rounded hover:bg-white/10 ${active ? activeColor : inactiveColor}`}
        >
            {children}
        </button>
    );
}
