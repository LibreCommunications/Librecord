import { useCallback, useEffect, useState } from "react";
import { appConnection } from "../realtime/connection";
import * as livekitClient from "../voice/livekitClient";
import {
    getVoiceState,
    setVoiceState,
    resetVoiceState,
    type VoiceState,
    type VoiceParticipant,
} from "../voice/voiceStore";

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
    }, []);

    const leaveVoice = useCallback(async () => {
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

    const toggleScreenShare = useCallback(async () => {
        const isScreenSharing = await livekitClient.toggleScreenShare();
        setVoiceState({ isScreenSharing });
        await appConnection.invoke("UpdateVoiceState", { isScreenSharing });
    }, []);

    return {
        voiceState,
        joinVoice,
        leaveVoice,
        toggleMute,
        toggleDeafen,
        toggleCamera,
        toggleScreenShare,
    };
}
