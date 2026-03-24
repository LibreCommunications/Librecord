import { useCallback, useEffect, useState } from "react";
import { appConnection } from "../realtime/connection";
import * as livekitClient from "../voice/livekitClient";
import type { ScreenShareSettings } from "../voice/livekitClient";
import {
    getVoiceState,
    setVoiceState,
    resetVoiceState,
    type VoiceState,
    type VoiceParticipant,
} from "../voice/voiceStore";
import { playJoinSound, playLeaveSound, playStreamStartSound, playStreamStopSound } from "../voice/sounds";

export function useVoice() {
    const [voiceState, setLocalState] = useState<VoiceState>(getVoiceState());

    useEffect(() => {
        const handler = (e: Event) => {
            setLocalState({ ...(e as CustomEvent<VoiceState>).detail });
        };
        window.addEventListener("voice:state:changed", handler);
        return () => window.removeEventListener("voice:state:changed", handler);
    }, []);

    const joinVoice = useCallback(async (channelId: string, guildId: string) => {
        const result = await appConnection.invoke<{
            token: string;
            wsUrl: string;
            participants: VoiceParticipant[];
        }>("JoinVoiceChannel", channelId);

        setVoiceState({
            channelId,
            guildId,
            participants: result.participants,
            isConnected: true,
            isMuted: false,
            isDeafened: false,
            isCameraOn: false,
            isScreenSharing: false,
        });

        await livekitClient.connectToVoice(result.token, result.wsUrl);
        playJoinSound();
    }, []);

    const leaveVoice = useCallback(async () => {
        playLeaveSound();
        await livekitClient.disconnect();
        try {
            await appConnection.invoke("LeaveVoiceChannel");
        } catch {
            // Connection may already be closed
        }
        resetVoiceState();
    }, []);

    const toggleMute = useCallback(async () => {
        const isMuted = await livekitClient.toggleMute();
        setVoiceState({ isMuted });
        await appConnection.invoke("UpdateVoiceState", { isMuted });
    }, []);

    const toggleDeafen = useCallback(async () => {
        const isDeafened = await livekitClient.toggleDeafen();
        setVoiceState({ isDeafened });
        await appConnection.invoke("UpdateVoiceState", { isDeafened });
    }, []);

    const toggleCamera = useCallback(async () => {
        const isCameraOn = await livekitClient.toggleCamera();
        setVoiceState({ isCameraOn });
        await appConnection.invoke("UpdateVoiceState", { isCameraOn });
    }, []);

    const startScreenShare = useCallback(async (options: ScreenShareSettings) => {
        const isScreenSharing = await livekitClient.startScreenShare(options);
        setVoiceState({ isScreenSharing });
        await appConnection.invoke("UpdateVoiceState", { isScreenSharing });
        playStreamStartSound();
    }, []);

    const stopScreenShare = useCallback(async () => {
        await livekitClient.stopScreenShare();
        setVoiceState({ isScreenSharing: false });
        await appConnection.invoke("UpdateVoiceState", { isScreenSharing: false });
        playStreamStopSound();
    }, []);

    return {
        voiceState,
        joinVoice,
        leaveVoice,
        toggleMute,
        toggleDeafen,
        toggleCamera,
        startScreenShare,
        stopScreenShare,
    };
}
