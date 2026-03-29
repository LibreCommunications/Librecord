import {
    Room,
    RoomEvent,
    Track,
    VideoPreset,
    type RemoteParticipant,
    type RemoteTrackPublication,
    type LocalParticipant,
} from "livekit-client";

let room: Room | null = null;

// ── Device preferences (localStorage) ────────────────────────
const DEVICE_PREFS_KEY = "librecord:devicePrefs";
type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

export function getDevicePref(kind: DeviceKind): string | undefined {
    try {
        const prefs = JSON.parse(localStorage.getItem(DEVICE_PREFS_KEY) ?? "{}");
        return prefs[kind] || undefined;
    } catch { return undefined; }
}

export function setDevicePref(kind: DeviceKind, deviceId: string) {
    try {
        const prefs = JSON.parse(localStorage.getItem(DEVICE_PREFS_KEY) ?? "{}");
        prefs[kind] = deviceId;
        localStorage.setItem(DEVICE_PREFS_KEY, JSON.stringify(prefs));
    } catch { /* ignore */ }
}

export function getAllDevicePrefs(): Record<DeviceKind, string | undefined> {
    try {
        const prefs = JSON.parse(localStorage.getItem(DEVICE_PREFS_KEY) ?? "{}");
        return { audioinput: prefs.audioinput, videoinput: prefs.videoinput, audiooutput: prefs.audiooutput };
    } catch { return { audioinput: undefined, videoinput: undefined, audiooutput: undefined }; }
}

const SPEAKING_THRESHOLD = 0.015;
const SPEAKING_OFF_DELAY = 300;

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

// Per-user audio pipeline: Web Audio API with GainNode for volume control.
// Uses MediaStreamSource directly (not MediaElementSource) because
// createMediaElementSource doesn't work with live MediaStream/WebRTC sources.
interface AudioPipeline {
    ctx: AudioContext;
    gain: GainNode;
    source: MediaStreamAudioSourceNode;
}
const audioPipelines = new Map<string, AudioPipeline>();

// dB-linear volume curve (same approach as OBS / Discord / DAWs).
// Slider maps linearly to decibels, then converted to gain.
//   0%   → mute (gain 0)
//   1%   → -60 dB (gain 0.001)
//  50%   → -30 dB (gain 0.03)
//  100%  →   0 dB (gain 1.0, unity)
//  200%  → +26 dB (gain ~20)
function pctToGain(pct: number): number {
    if (pct <= 0) return 0;
    const dB = pct <= 100
        ? -60 + (pct / 100) * 60      // 1% = -60dB, 100% = 0dB
        : ((pct - 100) / 100) * 26;   // 100% = 0dB, 200% = +26dB
    return Math.pow(10, dB / 20);
}

function applyVolume(identity: string, pct: number) {
    const pipe = audioPipelines.get(identity);
    if (!pipe) return;
    const target = pctToGain(pct);
    pipe.gain.gain.cancelScheduledValues(pipe.ctx.currentTime);
    pipe.gain.gain.setTargetAtTime(target, pipe.ctx.currentTime, 0.015);
}

// Listen for per-user volume changes and apply to audio elements
window.addEventListener("voice:volume:changed", ((e: CustomEvent<{ userId: string; volume: number }>) => {
    applyVolume(e.detail.userId, e.detail.volume);
}) as EventListener);

// Web Audio API handles all remote audio playback and per-user volume control.

function attachAudioTrack(identity: string, track: MediaStreamTrack) {
    detachAudioTrack(identity);

    const stream = new MediaStream([track]);
    const ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    // MediaStreamSource → GainNode → speakers
    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);

    // Apply per-user volume from localStorage
    let pct = 100;
    try {
        const vols = JSON.parse(localStorage.getItem("librecord:userVolumes") ?? "{}");
        pct = vols[identity] ?? 100;
    } catch { /* default */ }
    gain.gain.value = pctToGain(pct);

    audioPipelines.set(identity, { ctx, gain, source });
}

function detachAudioTrack(identity: string) {
    const pipe = audioPipelines.get(identity);
    if (pipe) {
        pipe.source.disconnect();
        pipe.gain.disconnect();
        pipe.ctx.close().catch(() => {});
        audioPipelines.delete(identity);
    }
}

function detachAllAudio() {
    for (const [id] of audioPipelines) {
        detachAudioTrack(id);
    }
}

function bindRemoteAudioTrack(participant: RemoteParticipant) {
    participant.audioTrackPublications.forEach(pub => {
        const msTrack = pub.track?.mediaStreamTrack;
        if (msTrack) {
            startAnalysingTrack(participant.identity, msTrack);
        }
    });
}

export async function connectToVoice(token: string, wsUrl: string, initialMuted = false, initialDeafened = false) {
    if (room) await disconnect();

    const micId = getDevicePref("audioinput");
    const camId = getDevicePref("videoinput");

    room = new Room({
        dynacast: true,
        adaptiveStream: true,
        audioCaptureDefaults: {
            autoGainControl: true,
            noiseSuppression: true,
            echoCancellation: true,
            ...(micId && { deviceId: micId }),
        },
        videoCaptureDefaults: {
            ...(camId && { deviceId: camId }),
        },
    });

    room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        stopAnalysingTrack(p.identity);
    });

    room.on(RoomEvent.TrackSubscribed, (track, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (track.kind === "audio") {
            const msTrack = track.mediaStreamTrack;
            if (msTrack) {
                startAnalysingTrack(p.identity, msTrack);
                attachAudioTrack(p.identity, msTrack);
            }
        }
    });

    room.on(RoomEvent.TrackUnsubscribed, (_t, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (pub.kind === "audio") {
            stopAnalysingTrack(p.identity);
            detachAudioTrack(p.identity);
        }
    });

    room.on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.kind === "audio") {
            const msTrack = pub.track?.mediaStreamTrack;
            if (msTrack) {
                startAnalysingTrack(room!.localParticipant.identity, msTrack);
            }
        }
    });

    room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.kind === "audio") {
            stopAnalysingTrack(room!.localParticipant.identity);
        }
    });

    await room.connect(wsUrl, token);
    await room.localParticipant.setMicrophoneEnabled(!initialMuted);

    if (initialDeafened) {
        isDeafened = true;
    }

    await room.startAudio();

    room.remoteParticipants.forEach(bindRemoteAudioTrack);

    const localAudioPub = room.localParticipant.audioTrackPublications.values().next().value;
    if (localAudioPub?.track?.mediaStreamTrack) {
        startAnalysingTrack(room.localParticipant.identity, localAudioPub.track.mediaStreamTrack);
    }
}

export async function disconnect() {
    stopAllAnalysers();
    detachAllAudio();
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

export async function toggleCamera(deviceId?: string): Promise<boolean> {
    if (!room) return false;
    const enabled = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(enabled, deviceId ? { deviceId } : undefined);
    return enabled;
}

export async function switchCamera(deviceId: string): Promise<void> {
    if (!room) return;
    await room.localParticipant.setCameraEnabled(true, { deviceId });
}

export async function listVideoDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === "videoinput");
}

export async function listAudioInputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === "audioinput");
}

export async function listAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === "audiooutput");
}

export async function switchMicrophone(deviceId: string): Promise<void> {
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(true, { deviceId });
}

export interface ScreenShareSettings {
    resolution: "720p" | "1080p" | "1440p" | "source";
    frameRate: 15 | 30 | 60;
    audio: boolean;
}

const RESOLUTION_MAP: Record<string, { width: number; height: number } | undefined> = {
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
    "1440p": { width: 2560, height: 1440 },
};

export async function startScreenShare(options: ScreenShareSettings): Promise<boolean> {
    if (!room) return false;

    const res = RESOLUTION_MAP[options.resolution];
    const encodeFps = options.frameRate;

    // "source" gives sender's native resolution, capped at 4K.
    let resolution: { width: number; height: number; frameRate?: number } | undefined;
    if (res) {
        resolution = { ...res, frameRate: encodeFps };
    } else {
        resolution = { width: 3840, height: 2160, frameRate: encodeFps };
    }

    // Encoding: match FPS with appropriate bitrate (LiveKit presets)
    const encodingBitrate = encodeFps >= 60 ? 7_000_000 : encodeFps >= 30 ? 5_000_000 : 2_500_000;

    try {
        await room.localParticipant.setScreenShareEnabled(true, {
            audio: options.audio,
            resolution,
        }, {
            screenShareEncoding: {
                maxFramerate: encodeFps,
                maxBitrate: encodingBitrate,
            },
            // One simulcast layer for small-tile viewers (960x540 capped at 30fps)
            screenShareSimulcastLayers: [
                new VideoPreset(960, 540, 1_500_000, Math.min(encodeFps, 30)),
            ],
        });
    } catch (e) {
        console.warn("[Voice] Screen share failed, retrying without constraints:", e);
        try {
            // Fallback: no constraints — maximum browser compatibility
            await room.localParticipant.setScreenShareEnabled(true, {
                audio: options.audio,
            });
        } catch (e2) {
            console.warn("[Voice] Screen share failed entirely:", e2);
            return false;
        }
    }

    // Some browsers reject contentHint in constraints but accept it post-capture
    try {
        const hint = encodeFps >= 30 ? "motion" : "detail";
        room.localParticipant.videoTrackPublications.forEach(pub => {
            if (pub.source === Track.Source.ScreenShare && pub.track?.mediaStreamTrack) {
                pub.track.mediaStreamTrack.contentHint = hint;
            }
        });
    } catch {
        // contentHint not supported — fine
    }

    return true;
}

export async function stopScreenShare(): Promise<boolean> {
    if (!room) return false;
    await room.localParticipant.setScreenShareEnabled(false);
    return false;
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
