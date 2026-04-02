import {
    Room,
    RoomEvent,
    Track,
    VideoPreset,
    ConnectionQuality,
    DisconnectReason,
    type RemoteParticipant,
    type RemoteTrackPublication,
    type LocalParticipant,
    type LocalTrackPublication,
} from "livekit-client";
import { showToast } from "../toast";
import { getUserVolume } from "../userVolume";
import {
    getNoiseSuppressionSettings,
    applyNoiseSuppressionToTrack,
    clearActiveProcessor,
    type LocalAudioTrackLike,
} from "./noiseSuppression";
import { logger } from "@librecord/domain";
import { onCustomEvent } from "../typedEvent";
import { STORAGE } from "@librecord/domain";

let room: Room | null = null;
let nsChangeListener: (() => void) | null = null;

function getLocalAudioTrack() {
    if (!room) return null;
    for (const pub of room.localParticipant.audioTrackPublications.values()) {
        if (pub.track) return pub.track;
    }
    return null;
}

// ── Device preferences (localStorage) ────────────────────────
type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

export function getDevicePref(kind: DeviceKind): string | undefined {
    try {
        const prefs = JSON.parse(localStorage.getItem(STORAGE.devicePrefs) ?? "{}");
        return prefs[kind] || undefined;
    } catch { return undefined; }
}

export function setDevicePref(kind: DeviceKind, deviceId: string) {
    try {
        const prefs = JSON.parse(localStorage.getItem(STORAGE.devicePrefs) ?? "{}");
        prefs[kind] = deviceId;
        localStorage.setItem(STORAGE.devicePrefs, JSON.stringify(prefs));
    } catch { /* ignore */ }
}

export function getAllDevicePrefs(): Record<DeviceKind, string | undefined> {
    try {
        const prefs = JSON.parse(localStorage.getItem(STORAGE.devicePrefs) ?? "{}");
        return { audioinput: prefs.audioinput, videoinput: prefs.videoinput, audiooutput: prefs.audiooutput };
    } catch { return { audioinput: undefined, videoinput: undefined, audiooutput: undefined }; }
}

const SPEAKING_THRESHOLD = 0.015;
const SPEAKING_OFF_DELAY = 300;

const analysers = new Map<string, {
    analyser: AnalyserNode;
    source: MediaStreamAudioSourceNode;
    speaking: boolean;
    silentSince: number;
}>();
let animFrameId: number | null = null;

function startAnalysingTrack(identity: string, track: MediaStreamTrack) {
    if (analysers.has(identity)) {
        const existing = analysers.get(identity)!;
        existing.source.disconnect();
        existing.analyser.disconnect();
        analysers.delete(identity);
    }

    const ctx = getPlaybackCtx();
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

// Single shared AudioContext for all users (browsers limit active contexts to ~6).
// Each user gets: MediaStreamSource → per-user GainNode → shared destination.
let _playbackCtx: AudioContext | null = null;

function getPlaybackCtx(): AudioContext {
    if (!_playbackCtx || _playbackCtx.state === "closed") {
        _playbackCtx = new AudioContext();
    }
    if (_playbackCtx.state === "suspended") _playbackCtx.resume().catch(e => logger.voice.warn("AudioContext resume failed", e));
    return _playbackCtx;
}

interface AudioPipeline {
    gain: GainNode;
    source: MediaStreamAudioSourceNode;
}
const audioPipelines = new Map<string, AudioPipeline>();
// Hidden <audio> elements per user — Chromium won't deliver remote WebRTC audio
// to Web Audio API nodes unless an <audio> element is also consuming the stream.
const audioElements = new Map<string, HTMLAudioElement>();

// dB-linear volume curve (same approach as OBS / Discord / DAWs).
// Slider maps linearly to decibels, then converted to gain.
//   0%   → mute (gain 0)
//   1%   → -40 dB (gain 0.01)
//  50%   → -20 dB (gain 0.1)
//  100%  →   0 dB (gain 1.0, unity)
//  200%  → +26 dB (gain ~20)
export function pctToGain(pct: number): number {
    if (pct <= 0) return 0;
    const dB = pct <= 100
        ? -40 + (pct / 100) * 40      // 1% = -40dB, 100% = 0dB
        : ((pct - 100) / 100) * 26;   // 100% = 0dB, 200% = +26dB
    return Math.pow(10, dB / 20);
}

function applyVolume(identity: string, pct: number) {
    const pipe = audioPipelines.get(identity);
    if (!pipe) return;
    const ctx = getPlaybackCtx();
    const target = pctToGain(pct);
    pipe.gain.gain.cancelScheduledValues(ctx.currentTime);
    pipe.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.015);
}

// Listen for per-user volume changes
onCustomEvent<{ userId: string; volume: number }>("voice:volume:changed", (detail) => {
    applyVolume(detail.userId, detail.volume);
});

// Per-user audio: MediaStreamSource → GainNode → shared AudioContext destination.

function attachAudioTrack(identity: string, track: MediaStreamTrack) {
    detachAudioTrack(identity);

    const ctx = getPlaybackCtx();
    const stream = new MediaStream([track]);
    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.value = pctToGain(getUserVolume(identity));

    // Chromium won't deliver remote WebRTC audio data to MediaStreamAudioSourceNode
    // unless an <audio> element is also consuming the stream. Attach a silent element
    // to keep the pipeline active. volume=0 (not muted attr) still pulls data.
    const el = document.createElement("audio");
    el.srcObject = stream;
    el.volume = 0;
    el.autoplay = true;
    el.play().catch(() => {});
    audioElements.set(identity, el);

    audioPipelines.set(identity, { gain, source });
}

function detachAudioTrack(identity: string) {
    const pipe = audioPipelines.get(identity);
    if (pipe) {
        pipe.source.disconnect();
        pipe.gain.disconnect();
        audioPipelines.delete(identity);
    }
    const el = audioElements.get(identity);
    if (el) {
        el.pause();
        el.srcObject = null;
        audioElements.delete(identity);
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
            attachAudioTrack(participant.identity, msTrack);
        }
    });
}

export async function connectToVoice(token: string, wsUrl: string, initialMuted = false, initialDeafened = false) {
    if (room) await disconnect();

    const micId = getDevicePref("audioinput");
    const camId = getDevicePref("videoinput");

    const nsSettings = getNoiseSuppressionSettings();
    // Disable browser's built-in noise suppression when we handle it ourselves
    const browserNS = nsSettings.mode === "off";

    room = new Room({
        dynacast: true,
        adaptiveStream: true,
        // Disable single peer connection mode — causes a=inactive on subscriber
        // audio lines in Chromium when joining after the publisher, resulting in
        // no audio playback. Firefox handles it fine but Edge/Chrome does not.
        singlePeerConnection: false,
        audioCaptureDefaults: {
            autoGainControl: true,
            noiseSuppression: browserNS,
            echoCancellation: true,
            ...(micId && { deviceId: micId }),
        },
        videoCaptureDefaults: {
            ...(camId && { deviceId: camId }),
        },
    });

    // ── LiveKit observability ─────────────────────────────────
    room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        logger.voice.warn("Room disconnected", reason);
    });

    room.on(RoomEvent.Reconnecting, () => {
        logger.voice.info("Reconnecting to voice server...");
        showToast("Reconnecting to voice...", "info");
    });

    room.on(RoomEvent.Reconnected, () => {
        logger.voice.info("Reconnected to voice server");
        showToast("Voice reconnected", "success");
    });

    room.on(RoomEvent.SignalReconnecting, () => {
        logger.voice.info("Signal connection reconnecting...");
    });

    room.on(RoomEvent.MediaDevicesError, (error: Error) => {
        logger.voice.error("Media device error", error);
        showToast(`Microphone/camera error: ${error.message}`, "error");
    });

    room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, participant) => {
        if (participant.identity === room!.localParticipant.identity) {
            if (quality === ConnectionQuality.Poor) {
                logger.voice.warn("Connection quality degraded to Poor");
            }
            window.dispatchEvent(new CustomEvent("voice:quality:changed", { detail: { quality } }));
        }
    });

    room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        logger.voice.info("Participant connected", p.identity);
        // Bind any tracks that are already subscribed at join time
        bindRemoteAudioTrack(p);
    });

    room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        stopAnalysingTrack(p.identity);
        detachAudioTrack(p.identity);
    });

    room.on(RoomEvent.TrackSubscribed, (track, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
        logger.voice.info("Track subscribed", p.identity, track.kind, track.source);
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

    room.on(RoomEvent.LocalTrackPublished, async (pub: LocalTrackPublication) => {
        if (pub.kind !== "audio" || !pub.track) return;
        const identity = room!.localParticipant.identity;

        if (getNoiseSuppressionSettings().mode !== "off") {
            try {
                const processedTrack = await applyNoiseSuppressionToTrack(
                    pub.track as unknown as LocalAudioTrackLike,
                );
                if (processedTrack) {
                    startAnalysingTrack(identity, processedTrack);
                    return;
                }
            } catch (err) {
                logger.voice.warn("Failed to apply noise suppression", err);
            }
        }

        // Fallback: use raw track when mode is off or processor failed
        const msTrack = pub.track?.mediaStreamTrack;
        if (msTrack) {
            startAnalysingTrack(identity, msTrack);
        }
    });

    room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.kind === "audio") {
            stopAnalysingTrack(room!.localParticipant.identity);
        }
    });

    // Listen for runtime noise suppression mode changes
    const onNsChanged = async () => {
        if (!room) return;
        const localAudioTrack = getLocalAudioTrack();
        if (!localAudioTrack) return;
        const identity = room.localParticipant.identity;
        try {
            const processedTrack = await applyNoiseSuppressionToTrack(
                localAudioTrack as unknown as LocalAudioTrackLike,
            );
            const analyseTrack = processedTrack ?? localAudioTrack.mediaStreamTrack;
            if (analyseTrack) startAnalysingTrack(identity, analyseTrack);
        } catch (err) {
            logger.voice.warn("Failed to apply noise suppression", err);
        }
    };
    window.addEventListener("voice:noisesuppression:changed", onNsChanged);
    nsChangeListener = onNsChanged;

    await room.connect(wsUrl, token);
    await room.localParticipant.setMicrophoneEnabled(!initialMuted);

    if (initialDeafened) {
        isDeafened = true;
    }

    await room.startAudio().catch(e => logger.voice.warn("startAudio failed", e));

    // Bind tracks for participants already in the room
    room.remoteParticipants.forEach((p) => {
        logger.voice.info("Binding existing participant", p.identity, "tracks:", p.audioTrackPublications.size);
        bindRemoteAudioTrack(p);
    });
    // Local track speaking detection + noise suppression are handled
    // by the LocalTrackPublished event handler above.
}

export async function disconnect() {
    stopAllAnalysers();
    detachAllAudio();
    if (nsChangeListener) {
        window.removeEventListener("voice:noisesuppression:changed", nsChangeListener);
        nsChangeListener = null;
    }
    clearActiveProcessor();
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

export async function switchActiveDevice(kind: MediaDeviceKind, deviceId: string): Promise<void> {
    if (!room) return;
    await room.switchActiveDevice(kind, deviceId);
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
        logger.voice.warn("Screen share failed, retrying without constraints", e);
        try {
            // Fallback: no constraints — maximum browser compatibility
            await room.localParticipant.setScreenShareEnabled(true, {
                audio: options.audio,
            });
        } catch (e2) {
            logger.voice.warn("Screen share failed entirely", e2);
            showToast("Screen share failed", "error");
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
