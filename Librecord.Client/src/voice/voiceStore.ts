export interface VoiceParticipant {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isMuted: boolean;
    isDeafened: boolean;
    isCameraOn: boolean;
    isScreenSharing: boolean;
    joinedAt: string;
}

export interface VoiceState {
    channelId: string | null;
    guildId: string | null;
    participants: VoiceParticipant[];
    isMuted: boolean;
    isDeafened: boolean;
    isCameraOn: boolean;
    isScreenSharing: boolean;
    isConnected: boolean;
}

const INITIAL_STATE: VoiceState = {
    channelId: null,
    guildId: null,
    participants: [],
    isMuted: false,
    isDeafened: false,
    isCameraOn: false,
    isScreenSharing: false,
    isConnected: false,
};

let state: VoiceState = { ...INITIAL_STATE };

function emit() {
    window.dispatchEvent(new CustomEvent("voice:state:changed", { detail: state }));
}

function update(patch: Partial<VoiceState>) {
    state = { ...state, ...patch };
    emit();
}

export function getVoiceState(): VoiceState {
    return state;
}

export function setVoiceState(patch: Partial<VoiceState>) {
    update(patch);
}

export function addParticipant(participant: VoiceParticipant) {
    update({
        participants: [
            ...state.participants.filter(p => p.userId !== participant.userId),
            participant,
        ],
    });
}

export function removeParticipant(userId: string) {
    update({
        participants: state.participants.filter(p => p.userId !== userId),
    });
}

export function updateParticipantState(
    userId: string,
    flags: Partial<Pick<VoiceParticipant, "isMuted" | "isDeafened" | "isCameraOn" | "isScreenSharing">>
) {
    update({
        participants: state.participants.map(p =>
            p.userId === userId ? { ...p, ...flags } : p
        ),
    });
}

export function resetVoiceState() {
    state = { ...INITIAL_STATE };
    emit();
}
