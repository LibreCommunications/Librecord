import { memo, useState } from "react";
import { VolumePopup } from "../voice/VolumePopup";
import { ScreenShareIcon, CameraIcon, MicOffIcon, HeadphonesOffIcon } from "../voice/VoiceIcons";

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
    const [volumePopup, setVolumePopup] = useState<{ userId: string; displayName: string; x: number; y: number } | null>(null);

    if (participants.length === 0) return null;

    const isInVoiceChannel = voiceState.isConnected && voiceState.channelId === channelId;

    return (
        <div className="ml-7 mr-2 mt-0.5 mb-1 space-y-px">
            {participants.map(raw => {
                const isLocal = raw.userId === localUserId && isInVoiceChannel;
                const p = isLocal ? { ...raw, isMuted: voiceState.isMuted, isDeafened: voiceState.isDeafened, isCameraOn: voiceState.isCameraOn, isScreenSharing: voiceState.isScreenSharing } : raw;
                const isSpeaking = speakingMap[p.userId] ?? false;
                return (
                    <div
                        key={p.userId}
                        className="flex items-center gap-1.5 text-[13px] text-[#949ba4] py-[3px] rounded hover:bg-[#35373c] px-1 cursor-default"
                        onContextMenu={e => {
                            if (isLocal) return; // can't adjust own volume
                            e.preventDefault();
                            setVolumePopup({ userId: p.userId, displayName: p.displayName, x: e.clientX, y: e.clientY });
                        }}
                    >
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
                            {p.isScreenSharing && <ScreenShareIcon size={12} className="text-[#5865f2]" />}
                            {p.isCameraOn && <CameraIcon size={12} className="text-[#dbdee1]" />}
                            {p.isMuted && <MicOffIcon size={12} className="text-red-400" />}
                            {p.isDeafened && <HeadphonesOffIcon size={12} className="text-red-400" />}
                        </span>
                    </div>
                );
            })}

            {volumePopup && (
                <VolumePopup
                    userId={volumePopup.userId}
                    displayName={volumePopup.displayName}
                    x={volumePopup.x}
                    y={volumePopup.y}
                    onClose={() => setVolumePopup(null)}
                />
            )}
        </div>
    );
});
