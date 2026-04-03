// Hooks
export * from "./hooks/index.ts";

// Hook types (re-exported for convenience)
export { type ChatChannelConfig } from "./hooks/useChatChannel.ts";
export { type FriendshipListDto, type FriendSuggestion } from "./hooks/useFriends.ts";

// Context providers
export * from "./context/index.ts";

// Realtime
export { registerListeners } from "./realtime/listeners.ts";
export { initNotifications, cleanupNotifications } from "./realtime/notifications.ts";
export { RealtimeRoot } from "./realtime/RealtimeRoot.tsx";
export { initCacheInvalidation } from "./cacheInvalidation.ts";

// Voice
export {
    getVoiceState,
    setVoiceState,
    resetVoiceState,
    getVoicePrefs,
    addParticipant,
    removeParticipant,
    updateParticipantState,
    getPersistedVoiceSession,
    clearPersistedVoiceSession,
    setVoicePrefs,
    type VoiceParticipant,
    type VoiceState,
} from "./voice/voiceStore.ts";
export * as livekitClient from "./voice/livekitClient.ts";
export {
    getRoom,
    getLocalParticipant,
    getRemoteParticipants,
    getParticipantTracks,
    getDevicePref,
    setDevicePref,
    getAllDevicePrefs,
    pctToGain,
} from "./voice/livekitClient.ts";
export { playJoinSound, playLeaveSound, playStreamStartSound, playStreamStopSound, playRingtone, stopRingtone } from "./voice/sounds.ts";
export {
    getNoiseSuppressionSettings,
    setNoiseSuppressionSettings,
    applyNoiseSuppressionToTrack,
    getProcessedTrack,
    clearActiveProcessor,
    type NoiseSuppressionMode,
    type NoiseSuppressionSettings,
    type LocalAudioTrackLike,
} from "./voice/noiseSuppression.ts";
export { useTrackBySource } from "./voice/useTrackBySource.ts";

// Lib
export { showToast } from "./toast.ts";
export { onCustomEvent, onEvent } from "./typedEvent.ts";
export { getUserVolume, setUserVolume } from "./userVolume.ts";
