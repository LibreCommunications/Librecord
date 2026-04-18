import type { AudioService } from "@librecord/platform";

// Stub. Voice/call audio will go through LiveKit's React Native SDK; notification
// dings etc. can use react-native-sound later.
export const nativeAudio: AudioService = {
    playUrl: () => {},
    playBuffer: () => {},
};
