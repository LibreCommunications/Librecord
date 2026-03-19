import {
    Room,
    RoomEvent,
    Track,
    type RemoteParticipant,
    type RemoteTrackPublication,
    type LocalParticipant,
    type Participant,
    ParticipantEvent,
} from "livekit-client";

let room: Room | null = null;

type SpeakingCb = (identity: string, speaking: boolean) => void;
type IdentityCb = (identity: string) => void;
type VoidCb = () => void;

interface Callbacks {
    onParticipantConnected?: IdentityCb;
    onParticipantDisconnected?: IdentityCb;
    onTrackSubscribed?: VoidCb;
    onTrackUnsubscribed?: VoidCb;
    onSpeakingChanged?: SpeakingCb;
}

let cbs: Callbacks = {};

export function setCallbacks(newCbs: Callbacks) {
    cbs = newCbs;
}

function bindSpeaking(participant: Participant) {
    participant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
        cbs.onSpeakingChanged?.(participant.identity, speaking);
    });
}

export async function connectToVoice(token: string, wsUrl: string) {
    if (room) await disconnect();

    room = new Room({
        // dynacast: only encode video layers that subscribers actually need,
        // saving bandwidth when viewers have small viewports or are absent.
        dynacast: true,
        // adaptiveStream: receiver automatically signals the SFU which video
        // quality it needs based on the subscribing element's viewport size.
        adaptiveStream: true,
    });

    room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        cbs.onParticipantConnected?.(p.identity);
        bindSpeaking(p);
    });

    room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        cbs.onParticipantDisconnected?.(p.identity);
    });

    room.on(RoomEvent.TrackSubscribed, (_t, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        cbs.onTrackSubscribed?.();
        // Notify UI components so they can attach the new track immediately
        window.dispatchEvent(new CustomEvent("voice:track:changed", {
            detail: { identity: p.identity, source: pub.source },
        }));
    });

    room.on(RoomEvent.TrackUnsubscribed, (_t, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        cbs.onTrackUnsubscribed?.();
        window.dispatchEvent(new CustomEvent("voice:track:changed", {
            detail: { identity: p.identity, source: pub.source },
        }));
    });

    // Also notify when the local participant publishes a track (for self-view)
    room.on(RoomEvent.LocalTrackPublished, (pub) => {
        window.dispatchEvent(new CustomEvent("voice:track:changed", {
            detail: { identity: room!.localParticipant.identity, source: pub.source },
        }));
    });

    room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        window.dispatchEvent(new CustomEvent("voice:track:changed", {
            detail: { identity: room!.localParticipant.identity, source: pub.source },
        }));
    });

    await room.connect(wsUrl, token);
    await room.localParticipant.setMicrophoneEnabled(true);

    bindSpeaking(room.localParticipant);
    room.remoteParticipants.forEach(bindSpeaking);
}

export async function disconnect() {
    if (!room) return;
    await room.disconnect(true);
    room = null;
    isDeafened = false;
}

export async function toggleMute(): Promise<boolean> {
    if (!room) return false;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    return enabled; // isMuted = was-enabled
}

let isDeafened = false;

export async function toggleDeafen(): Promise<boolean> {
    if (!room) return false;

    isDeafened = !isDeafened;

    room.remoteParticipants.forEach(p => {
        p.audioTrackPublications.forEach(pub => {
            const msTrack = pub.track?.mediaStreamTrack;
            if (msTrack) {
                msTrack.enabled = !isDeafened;
            }
        });
    });

    return isDeafened;
}

export async function toggleCamera(): Promise<boolean> {
    if (!room) return false;
    const enabled = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(enabled);
    return enabled;
}

export async function toggleScreenShare(): Promise<boolean> {
    if (!room) return false;
    const sharing = !room.localParticipant.isScreenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(sharing, { audio: true });
    return sharing;
}

export function getRoom(): Room | null {
    return room;
}

export function getLocalParticipant(): LocalParticipant | null {
    return room?.localParticipant ?? null;
}

export function getRemoteParticipants(): Map<string, RemoteParticipant> {
    return room?.remoteParticipants ?? new Map();
}

export function getParticipantTracks(identity: string): {
    camera: Track | null;
    screen: Track | null;
} {
    if (!room) return { camera: null, screen: null };

    const participant =
        room.localParticipant.identity === identity
            ? room.localParticipant
            : room.remoteParticipants.get(identity) ?? null;

    if (!participant) return { camera: null, screen: null };

    let camera: Track | null = null;
    let screen: Track | null = null;

    participant.videoTrackPublications.forEach(pub => {
        if (!pub.track) return;
        if (pub.source === Track.Source.Camera) camera = pub.track;
        else if (pub.source === Track.Source.ScreenShare) screen = pub.track;
    });

    return { camera, screen };
}
