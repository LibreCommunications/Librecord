import {
    Room,
    RoomEvent,
    Track,
    type RemoteParticipant,
    type RemoteTrackPublication,
    type LocalParticipant,
} from "livekit-client";

let room: Room | null = null;

// ─── CLIENT-SIDE SPEAKING DETECTION ────────────────────────────────────
// Uses the Web Audio API to analyze received audio levels locally.
// Zero round-trip to the SFU — the green border appears the instant
// audio is loud enough, not 1s later when the server tells us.

const SPEAKING_THRESHOLD = 0.015; // RMS threshold (0-1)
const SPEAKING_OFF_DELAY = 300;   // ms of silence before "not speaking"

const audioCtxRef: { ctx: AudioContext | null } = { ctx: null };
const analysers = new Map<string, {
    analyser: AnalyserNode;
    source: MediaStreamAudioSourceNode;
    speaking: boolean;
    silentSince: number;
}>();
let animFrameId: number | null = null;

function getAudioCtx(): AudioContext | null {
    if (!audioCtxRef.ctx) {
        try {
            audioCtxRef.ctx = new AudioContext();
        } catch {
            console.warn("[Voice] AudioContext creation failed — speaking detection disabled");
            return null;
        }
    }
    return audioCtxRef.ctx;
}

function startAnalysingTrack(identity: string, track: MediaStreamTrack) {
    // Don't double-attach
    if (analysers.has(identity)) {
        const existing = analysers.get(identity)!;
        existing.source.disconnect();
        existing.analyser.disconnect();
        analysers.delete(identity);
    }

    const ctx = getAudioCtx();
    if (!ctx) return;
    const stream = new MediaStream([track]);
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    // Don't connect to destination — we don't want to double-play audio

    analysers.set(identity, { analyser, source, speaking: false, silentSince: 0 });

    // Start the polling loop if not already running
    if (animFrameId === null) {
        pollSpeaking();
    }
}

function stopAnalysingTrack(identity: string) {
    const entry = analysers.get(identity);
    if (entry) {
        entry.source.disconnect();
        entry.analyser.disconnect();
        analysers.delete(identity);
    }
    if (analysers.size === 0 && animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
}

function stopAllAnalysers() {
    for (const [id] of analysers) {
        stopAnalysingTrack(id);
    }
    if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
}

function pollSpeaking() {
    const now = Date.now();
    const buf = new Uint8Array(128);

    for (const [identity, entry] of analysers) {
        entry.analyser.getByteTimeDomainData(buf);

        // Compute RMS
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);

        const wasSpeaking = entry.speaking;

        if (rms > SPEAKING_THRESHOLD) {
            entry.speaking = true;
            entry.silentSince = 0;
        } else {
            if (entry.speaking) {
                if (entry.silentSince === 0) {
                    entry.silentSince = now;
                } else if (now - entry.silentSince > SPEAKING_OFF_DELAY) {
                    entry.speaking = false;
                    entry.silentSince = 0;
                }
            }
        }

        if (entry.speaking !== wasSpeaking) {
            window.dispatchEvent(new CustomEvent("voice:speaking:changed", {
                detail: { identity, speaking: entry.speaking },
            }));
        }
    }

    animFrameId = requestAnimationFrame(pollSpeaking);
}

// ─── ROOM SETUP ────────────────────────────────────────────────────────

function bindRemoteAudioTrack(participant: RemoteParticipant) {
    participant.audioTrackPublications.forEach(pub => {
        const msTrack = pub.track?.mediaStreamTrack;
        if (msTrack) {
            startAnalysingTrack(participant.identity, msTrack);
        }
    });
}

export async function connectToVoice(token: string, wsUrl: string) {
    if (room) await disconnect();

    room = new Room({
        dynacast: true,
        adaptiveStream: true,
        audioCaptureDefaults: {
            autoGainControl: true,
            noiseSuppression: true,
            echoCancellation: true,
        },
    });

    room.on(RoomEvent.ParticipantConnected, (_p: RemoteParticipant) => {
    });

    room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        stopAnalysingTrack(p.identity);
    });

    room.on(RoomEvent.TrackSubscribed, (track, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        window.dispatchEvent(new CustomEvent("voice:track:changed", {
            detail: { identity: p.identity, source: pub.source },
        }));
        // Start analysing audio tracks for speaking detection
        if (track.kind === "audio") {
            const msTrack = track.mediaStreamTrack;
            if (msTrack) {
                startAnalysingTrack(p.identity, msTrack);
            }
        }
    });

    room.on(RoomEvent.TrackUnsubscribed, (_t, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        window.dispatchEvent(new CustomEvent("voice:track:changed", {
            detail: { identity: p.identity, source: pub.source },
        }));
        if (pub.kind === "audio") {
            stopAnalysingTrack(p.identity);
        }
    });

    room.on(RoomEvent.LocalTrackPublished, (pub) => {
        window.dispatchEvent(new CustomEvent("voice:track:changed", {
            detail: { identity: room!.localParticipant.identity, source: pub.source },
        }));
        // Analyse own mic for self speaking indicator
        if (pub.kind === "audio") {
            const msTrack = pub.track?.mediaStreamTrack;
            if (msTrack) {
                startAnalysingTrack(room!.localParticipant.identity, msTrack);
            }
        }
    });

    room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        window.dispatchEvent(new CustomEvent("voice:track:changed", {
            detail: { identity: room!.localParticipant.identity, source: pub.source },
        }));
        if (pub.kind === "audio") {
            stopAnalysingTrack(room!.localParticipant.identity);
        }
    });

    await room.connect(wsUrl, token);
    await room.localParticipant.setMicrophoneEnabled(true);

    // Unlock browser audio playback for remote participants' audio tracks.
    await room.startAudio();

    // Start analysing audio for any participants already in the room
    room.remoteParticipants.forEach(bindRemoteAudioTrack);

    // Analyse own mic
    const localAudioPub = room.localParticipant.audioTrackPublications.values().next().value;
    if (localAudioPub?.track?.mediaStreamTrack) {
        startAnalysingTrack(room.localParticipant.identity, localAudioPub.track.mediaStreamTrack);
    }
}

export async function disconnect() {
    stopAllAnalysers();
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
