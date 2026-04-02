import { useEffect, useRef, useState } from "react";
import { PhoneHangupIcon } from "../ui/Icons";
import { useVoice } from "@librecord/app";
import { useToast } from "@librecord/app";
import { setVoiceState } from "@librecord/app";
import { onCustomEvent } from "@librecord/app";
import type { AppEventMap } from "@librecord/domain";

const CALL_TIMEOUT = 30_000;

interface Props {
    channelName: string;
    memberCount?: number; // total members in the DM channel (including caller)
}

export function OutgoingCallOverlay({ channelName, memberCount }: Props) {
    const { voiceState, leaveVoice } = useVoice();
    const { toast } = useToast();
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());

    // Reset declined set when a new outgoing call starts
    const channelRef = useRef(voiceState.channelId);
    useEffect(() => {
        if (voiceState.channelId !== channelRef.current) {
            channelRef.current = voiceState.channelId;
            setDeclinedIds(new Set());
        }
    }, [voiceState.channelId]);

    // Timeout — stop ringing but stay connected
    useEffect(() => {
        if (!voiceState.isOutgoingCall) return;

        timeoutRef.current = setTimeout(() => {
            setVoiceState({ isOutgoingCall: false });
        }, CALL_TIMEOUT);

        return () => clearTimeout(timeoutRef.current);
    }, [voiceState.isOutgoingCall]);

    // Listen for decline events
    useEffect(() => {
        if (!voiceState.isOutgoingCall || !voiceState.channelId) return;

        const callChannelId = voiceState.channelId;

        return onCustomEvent<AppEventMap["dm:call:declined"]>("dm:call:declined", (detail) => {
            if (detail.channelId !== callChannelId) return;

            setDeclinedIds(prev => {
                const next = new Set(prev);
                next.add(detail.userId);
                return next;
            });
        });
    }, [voiceState.isOutgoingCall, voiceState.channelId]);

    // Check if everyone declined
    useEffect(() => {
        if (!voiceState.isOutgoingCall || declinedIds.size === 0) return;

        // memberCount includes the caller, so others = memberCount - 1
        const othersCount = (memberCount ?? 2) - 1;
        if (declinedIds.size >= othersCount) {
            toast("Call declined", "info");
            leaveVoice();
        }
    }, [declinedIds, memberCount, voiceState.isOutgoingCall, toast, leaveVoice]);

    if (!voiceState.isOutgoingCall) return null;

    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#313338]/90">
            <div className="flex flex-col items-center gap-4">
                {/* Pulsing phone icon */}
                <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-[#3ba55d] flex items-center justify-center animate-pulse">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                    </div>
                    {/* Ripple rings */}
                    <div className="absolute inset-0 rounded-full border-2 border-[#3ba55d] animate-ping opacity-30" />
                </div>

                <div className="text-center">
                    <p className="text-white font-semibold text-lg">Calling {channelName}...</p>
                    <p className="text-[#949ba4] text-sm mt-1">Waiting for an answer</p>
                </div>

                <button
                    onClick={leaveVoice}
                    className="mt-4 w-14 h-14 rounded-full bg-[#ed4245] hover:bg-[#c03537] flex items-center justify-center transition-colors"
                    title="Cancel call"
                >
                    <PhoneHangupIcon size={24} className="text-white" />
                </button>
            </div>
        </div>
    );
}
