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

import { STORAGE } from "../lib/storageKeys";

export interface VoiceState {
    channelId: string | null;
    guildId: string | null;
    participants: VoiceParticipant[];
    isMuted: boolean;
    isDeafened: boolean;
    isCameraOn: boolean;
    isScreenSharing: boolean;
    isConnected: boolean;
    isOutgoingCall: boolean;
}


interface VoicePrefs {
    isMuted: boolean;
    isDeafened: boolean;
}

export function getVoicePrefs(): VoicePrefs {
    try {
        const raw = localStorage.getItem(STORAGE.voicePrefs);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { isMuted: false, isDeafened: false };
}

export function setVoicePrefs(prefs: Partial<VoicePrefs>) {
    const current = getVoicePrefs();
    localStorage.setItem(STORAGE.voicePrefs, JSON.stringify({ ...current, ...prefs }));
}

interface PersistedVoiceSession {
    channelId: string;
    guildId: string | null;
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
    isOutgoingCall: false,
};

let state: VoiceState = { ...INITIAL_STATE };

function emit() {
    window.dispatchEvent(new CustomEvent("voice:state:changed", { detail: state }));
}

function persist() {
    if (state.isConnected && state.channelId) {
        const session: PersistedVoiceSession = {
            channelId: state.channelId,
            guildId: state.guildId,
        };
        sessionStorage.setItem(STORAGE.voiceSession, JSON.stringify(session));
    } else {
        sessionStorage.removeItem(STORAGE.voiceSession);
    }
}

function update(patch: Partial<VoiceState>) {
    state = { ...state, ...patch };
    persist();
    emit();
}

export function getVoiceState(): VoiceState {
    return state;
}

export function getPersistedVoiceSession(): PersistedVoiceSession | null {
    try {
        const raw = sessionStorage.getItem(STORAGE.voiceSession);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function clearPersistedVoiceSession() {
    sessionStorage.removeItem(STORAGE.voiceSession);
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
    persist();
    emit();
}
