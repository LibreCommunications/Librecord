import { memo } from "react";

interface VoiceParticipant {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isMuted: boolean;
    isDeafened: boolean;
    isCameraOn: boolean;
    isScreenSharing: boolean;
}

interface VoiceParticipantListProps {
    participants: VoiceParticipant[];
    localUserId?: string;
    voiceState: { isMuted: boolean; isDeafened: boolean; isCameraOn: boolean; isScreenSharing: boolean; isConnected: boolean; channelId: string | null };
    channelId: string;
    speakingMap: Record<string, boolean>;
    getAvatarUrl: (url: string | null) => string;
}

export const VoiceParticipantList = memo(function VoiceParticipantList({ participants, localUserId, voiceState, channelId, speakingMap, getAvatarUrl }: VoiceParticipantListProps) {
    if (participants.length === 0) return null;

    const isInVoiceChannel = voiceState.isConnected && voiceState.channelId === channelId;

    return (
        <div className="ml-7 mr-2 mt-0.5 mb-1 space-y-px">
            {participants.map(raw => {
                const isLocal = raw.userId === localUserId && isInVoiceChannel;
                const p = isLocal ? { ...raw, isMuted: voiceState.isMuted, isDeafened: voiceState.isDeafened, isCameraOn: voiceState.isCameraOn, isScreenSharing: voiceState.isScreenSharing } : raw;
                const isSpeaking = speakingMap[p.userId] ?? false;
                return (
                    <div key={p.userId} className="flex items-center gap-1.5 text-[13px] text-[#949ba4] py-[3px]">
                        <img
                            src={getAvatarUrl(p.avatarUrl)}
                            alt=""
                            className={`
                                w-5 h-5 rounded-full object-cover shrink-0
                                transition-shadow duration-150
                                ${isSpeaking ? "shadow-[0_0_0_2px_#23a55a]" : ""}
                            `}
                        />
                        <span className="truncate flex-1">{p.displayName}</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                            {p.isScreenSharing && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#5865f2]">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                    <line x1="8" y1="21" x2="16" y2="21" />
                                    <line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                            )}
                            {p.isCameraOn && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#dbdee1]">
                                    <polygon points="23 7 16 12 23 17 23 7" />
                                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                </svg>
                            )}
                            {p.isMuted && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                                </svg>
                            )}
                            {p.isDeafened && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                                    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
});
