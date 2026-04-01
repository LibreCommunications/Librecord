import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useVoice } from "../../hooks/useVoice";
import {
    MicIcon, MicOffIcon,
    HeadphonesIcon, HeadphonesOffIcon,
    CameraIcon, ScreenShareIcon, PhoneOffIcon,
} from "./VoiceIcons";
import { ScreenShareModal, type ScreenShareOptions } from "./ScreenShareModal";
import * as livekitClient from "../../voice/livekitClient";
import { ConnectionQuality } from "livekit-client";

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

    const navigate = useNavigate();
    const location = useLocation();
    const [showScreenShareModal, setShowScreenShareModal] = useState(false);
    const [showCameraMenu, setShowCameraMenu] = useState(false);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [connQuality, setConnQuality] = useState<ConnectionQuality>(ConnectionQuality.Excellent);
    const cameraMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: Event) => {
            setConnQuality((e as CustomEvent<{ quality: ConnectionQuality }>).detail.quality);
        };
        window.addEventListener("voice:quality:changed", handler);
        return () => window.removeEventListener("voice:quality:changed", handler);
    }, []);

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

    // Build the path to the call's channel
    const callPath = voiceState.guildId
        ? `/app/guild/${voiceState.guildId}/${voiceState.channelId}`
        : `/app/dm/${voiceState.channelId}`;
    const isOnCallPage = location.pathname === callPath;

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
                <div className="flex items-center gap-2 mb-2" aria-live="polite" data-testid="voice-status">
                    <div className={`w-2 h-2 rounded-full ${
                        connQuality === ConnectionQuality.Poor ? "bg-red-500" :
                        connQuality === ConnectionQuality.Good ? "bg-yellow-500" :
                        "bg-green-500"
                    }`} />
                    <span className={`text-xs font-medium ${
                        connQuality === ConnectionQuality.Poor ? "text-red-400" :
                        connQuality === ConnectionQuality.Good ? "text-yellow-400" :
                        "text-green-400"
                    }`}>
                        {connQuality === ConnectionQuality.Poor ? "Poor Connection" :
                         connQuality === ConnectionQuality.Good ? "Unstable Connection" :
                         "Voice Connected"}
                    </span>
                </div>

                {!isOnCallPage && (
                    <button
                        onClick={() => navigate(callPath)}
                        className="w-full mb-2 py-1 rounded text-xs font-medium text-white bg-[#248046] hover:bg-[#1a6334] transition-colors"
                    >
                        Back to Call
                    </button>
                )}

                <div className="flex items-center gap-1">
                    <ControlButton
                        active={!voiceState.isMuted}
                        activeColor="text-white"
                        inactiveColor="text-red-400 bg-red-400/10"
                        onClick={toggleMute}
                        title={voiceState.isMuted ? "Unmute" : "Mute"}
                        testId="voice-mute-btn"
                    >
                        {voiceState.isMuted ? <MicOffIcon /> : <MicIcon />}
                    </ControlButton>

                    <ControlButton
                        active={!voiceState.isDeafened}
                        activeColor="text-white"
                        inactiveColor="text-red-400 bg-red-400/10"
                        onClick={toggleDeafen}
                        title={voiceState.isDeafened ? "Undeafen" : "Deafen"}
                        testId="voice-deafen-btn"
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
                            testId="voice-camera-btn"
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
                                            livekitClient.setDevicePref("videoinput", d.deviceId);
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
                        testId="voice-screenshare-btn"
                    >
                        <ScreenShareIcon />
                    </ControlButton>

                    <button
                        onClick={leaveVoice}
                        className="ml-auto p-2 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300"
                        title="Disconnect"
                        aria-label="Disconnect"
                        data-testid="voice-disconnect-btn"
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
    testId,
    children,
}: {
    active: boolean;
    activeColor: string;
    inactiveColor: string;
    onClick: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    title: string;
    testId?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            onContextMenu={onContextMenu}
            title={title}
            aria-label={title}
            data-testid={testId}
            className={`p-2 rounded hover:bg-white/10 ${active ? activeColor : inactiveColor}`}
        >
            {children}
        </button>
    );
}
