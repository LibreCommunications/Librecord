import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onCustomEvent } from "../../lib/typedEvent";
import type { AppEventMap } from "../../realtime/events";
import { useVoice } from "../../hooks/useVoice";
import { appConnection } from "../../realtime/connection";
import { API_URL } from "../../api/client";
import { playRingtone, stopRingtone } from "../../voice/sounds";
import { PhoneIcon, PhoneHangupIcon } from "../ui/Icons";

interface IncomingCall {
    channelId: string;
    callerId: string;
    callerDisplayName: string;
    callerAvatarUrl: string | null;
}

const RING_TIMEOUT = 30_000;

export function IncomingCallModal() {
    const [call, setCall] = useState<IncomingCall | null>(null);
    const { acceptDmCall, voiceState } = useVoice();
    const navigate = useNavigate();
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Suppress only if we already accepted THIS call (same channel), not any call
    const activeCall = call && !(voiceState.isConnected && voiceState.channelId === call.channelId) ? call : null;

    function dismiss() {
        setCall(null);
        stopRingtone();
        clearTimeout(timeoutRef.current);
    }

    // Stop ringtone whenever the active call disappears (connected, declined, timeout)
    const prevActiveRef = useRef(activeCall);
    useEffect(() => {
        if (prevActiveRef.current && !activeCall) {
            stopRingtone();
            clearTimeout(timeoutRef.current);
        }
        prevActiveRef.current = activeCall;
    });

    // Listen for incoming calls
    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:call:incoming"]>(
            "dm:call:incoming",
            (detail) => {
                setCall(prev => {
                    // Don't show if already ringing
                    if (prev) return prev;

                    playRingtone();

                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = setTimeout(() => {
                        setCall(null);
                        stopRingtone();
                    }, RING_TIMEOUT);

                    return {
                        channelId: detail.channelId,
                        callerId: detail.callerId,
                        callerDisplayName: detail.callerDisplayName,
                        callerAvatarUrl: detail.callerAvatarUrl,
                    };
                });
            },
        );
    }, []);

    // Dismiss if caller leaves before we answer
    useEffect(() => {
        if (!call) return;
        return onCustomEvent<AppEventMap["voice:user:left"]>(
            "voice:user:left",
            (detail) => {
                if (detail.userId === call.callerId && detail.channelId === call.channelId) {
                    dismiss();
                }
            },
        );
    }, [call]);

    // Dismiss if the call is declined / cancelled
    useEffect(() => {
        if (!call) return;
        return onCustomEvent<AppEventMap["dm:call:declined"]>(
            "dm:call:declined",
            (detail) => {
                if (detail.channelId === call.channelId) {
                    dismiss();
                }
            },
        );
    }, [call]);

    // Cleanup ringtone on unmount
    useEffect(() => () => stopRingtone(), []);

    if (!activeCall) return null;

    async function handleAccept() {
        const channelId = activeCall!.channelId;
        dismiss();
        await acceptDmCall(channelId);
        navigate(`/app/dm/${channelId}`);
    }

    function handleDecline() {
        const channelId = activeCall!.channelId;
        dismiss();
        appConnection.invoke("DeclineDmCall", channelId).catch(() => {});
    }

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60">
            <div className="bg-[#313338] rounded-xl p-6 w-80 shadow-2xl flex flex-col items-center gap-4 animate-[scaleIn_0.15s_ease-out]">
                <div className="w-16 h-16 rounded-full bg-[#5865F2] flex items-center justify-center overflow-hidden">
                    {activeCall.callerAvatarUrl ? (
                        <img src={`${API_URL}${activeCall.callerAvatarUrl}`} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <span className="text-2xl text-white font-bold">
                            {activeCall.callerDisplayName.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>

                <div className="text-center">
                    <p className="text-white font-semibold text-lg">{activeCall.callerDisplayName}</p>
                    <p className="text-[#949ba4] text-sm">Incoming call...</p>
                </div>

                <div className="flex gap-6 mt-2">
                    <button
                        onClick={handleDecline}
                        className="w-12 h-12 rounded-full bg-[#ed4245] hover:bg-[#c03537] flex items-center justify-center transition-colors"
                        title="Decline"
                    >
                        <PhoneHangupIcon size={22} className="text-white" />
                    </button>
                    <button
                        onClick={handleAccept}
                        className="w-12 h-12 rounded-full bg-[#3ba55d] hover:bg-[#2d8049] flex items-center justify-center transition-colors"
                        title="Accept"
                    >
                        <PhoneIcon size={22} className="text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
}
