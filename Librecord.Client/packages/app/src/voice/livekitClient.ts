import {
    Room,
    RoomEvent,
    Track,
    LocalVideoTrack,
    LocalAudioTrack,
    ConnectionQuality,
    DisconnectReason,
    type RemoteParticipant,
    type RemoteTrackPublication,
    type LocalParticipant,
    type LocalTrackPublication,
    type TrackPublishOptions,
} from "livekit-client";
import { showToast } from "../toast";
import { getUserVolume } from "../userVolume";
import {
    getNoiseSuppressionSettings,
    applyNoiseSuppressionToTrack,
    clearActiveProcessor,
    type LocalAudioTrackLike,
} from "./noiseSuppression";
import { logger, getElectronAPI, getPipecapAPI, getWinAudioAPI, isDesktop } from "@librecord/domain";
import * as pipecapScreenShare from "./pipecapScreenShare";
import * as winaudio from "./winaudio";
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
    try {
        if (!_playbackCtx || _playbackCtx.state === "closed") {
            _playbackCtx = new AudioContext();
        }
        if (_playbackCtx.state === "suspended") _playbackCtx.resume().catch(e => logger.voice.warn("AudioContext resume failed", e));
    } catch (e) {
        logger.voice.warn("AudioContext creation failed", e);
    }
    return _playbackCtx!;
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
            const isScreenAudio = pub.source === Track.Source.ScreenShareAudio;
            const pipelineKey = isScreenAudio ? `${participant.identity}:screen` : participant.identity;
            if (!isScreenAudio) {
                startAnalysingTrack(participant.identity, msTrack);
            }
            attachAudioTrack(pipelineKey, msTrack);
        }
    });
}

/** Unsubscribe any screen share tracks for a remote participant.
 *  Viewers must opt in via the Watch button in ScreenShareTile. */
function unsubscribeScreenShareTracks(p: RemoteParticipant) {
    for (const pub of p.trackPublications.values()) {
        if (pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio) {
            pub.setSubscribed(false);
        }
    }
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
        // Every audio track in the room must declare identical Opus fmtp
        // params or WebRTC's BUNDLE check rejects the SDP and loops on
        // re-negotiation, leaving zombie publications on the SFU. Force
        // stereo + red/dtx off so the mic and screen-share-audio match.
        publishDefaults: {
            red: false,
            dtx: false,
            forceStereo: true,
        },
    });

    // ── LiveKit observability ─────────────────────────────────
    room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        logger.voice.warn("Room disconnected", reason);
    });

    room.on(RoomEvent.Reconnecting, () => {
        logger.voice.info("Reconnecting to voice server...");
        showToast("Reconnecting to voice...", "info");
        // Drop any active noise-suppression processor NOW. LiveKit is
        // about to tear down the publisher PeerConnection and rebuild it;
        // the RTCRtpSender our rnnoise/threshold processor was attached
        // to will be dead after the rebuild. If we don't clear the module
        // state, the next LocalTrackPublished will try to `replaceTrack`
        // on a stale sender with a stale raw track, silently leaving the
        // new sender with no audio going to remote participants.
        clearActiveProcessor();
    });

    room.on(RoomEvent.Reconnected, async () => {
        logger.voice.info("Reconnected to voice server");
        showToast("Voice reconnected", "success");
        // Re-apply noise suppression on the freshly-republished mic
        // track. LocalTrackPublished doesn't always fire on reconnect
        // (LiveKit may reuse the existing publication), so do it here
        // explicitly. If NS mode is "off" this is a cheap no-op.
        if (getNoiseSuppressionSettings().mode !== "off") {
            const localAudioTrack = getLocalAudioTrack();
            if (localAudioTrack) {
                try {
                    const processedTrack = await applyNoiseSuppressionToTrack(
                        localAudioTrack as unknown as LocalAudioTrackLike,
                    );
                    if (processedTrack && room) {
                        startAnalysingTrack(room.localParticipant.identity, processedTrack);
                    }
                } catch (err) {
                    logger.voice.warn("Failed to re-apply noise suppression after reconnect", err);
                }
            }
        }
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
        // Unsubscribe screen share tracks — viewer must opt in via Watch button
        unsubscribeScreenShareTracks(p);
    });

    room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        stopAnalysingTrack(p.identity);
        detachAudioTrack(p.identity);
        detachAudioTrack(`${p.identity}:screen`);
    });

    // Screen share tracks require explicit opt-in via the Watch button.
    // Unsubscribe immediately when published to prevent audio leaking
    // before the viewer clicks Watch.
    room.on(RoomEvent.TrackPublished, (publication: RemoteTrackPublication, _p: RemoteParticipant) => {
        if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) {
            publication.setSubscribed(false);
        }
    });

    room.on(RoomEvent.TrackSubscribed, (track, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
        const isScreenAudio = track.source === Track.Source.ScreenShareAudio;
        logger.voice.info("Track subscribed", p.identity, track.kind, track.source, isScreenAudio ? "(screen share audio)" : "");
        if (track.kind === "audio") {
            const msTrack = track.mediaStreamTrack;
            if (msTrack) {
                const pipelineKey = isScreenAudio ? `${p.identity}:screen` : p.identity;
                if (isScreenAudio) {
                    // Screen share audio is attached when the user clicks "Watch"
                    // via ScreenShareTile subscription toggle — attach it here too
                    // since TrackSubscribed fires after setSubscribed(true).
                    attachAudioTrack(pipelineKey, msTrack);
                    logger.voice.info(`Screen share audio attached for ${p.identity}`);
                } else {
                    startAnalysingTrack(p.identity, msTrack);
                    attachAudioTrack(pipelineKey, msTrack);
                    logger.voice.info(`Voice audio attached for ${p.identity}`);
                }
            }
        }
    });

    room.on(RoomEvent.TrackUnsubscribed, (_t, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (pub.kind === "audio") {
            const isScreenAudio = pub.source === Track.Source.ScreenShareAudio;
            const pipelineKey = isScreenAudio ? `${p.identity}:screen` : p.identity;
            if (!isScreenAudio) {
                stopAnalysingTrack(p.identity);
            }
            detachAudioTrack(pipelineKey);
            logger.voice.info(isScreenAudio
                ? `Screen share audio detached for ${p.identity}`
                : `Voice audio detached for ${p.identity}`);
        }
    });

    room.on(RoomEvent.LocalTrackPublished, async (pub: LocalTrackPublication) => {
        // Only analyse the mic track for speaking detection, not screen share audio
        if (pub.kind !== "audio" || !pub.track || pub.source === Track.Source.ScreenShareAudio) return;
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
        if (pub.kind === "audio" && pub.source !== Track.Source.ScreenShareAudio) {
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
        // Unsubscribe screen share tracks — viewer must opt in via Watch button
        unsubscribeScreenShareTracks(p);
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

// Screen content bits-per-pixel tuned per codec. H.264 is less efficient
// than VP9 for screen content (no native screen-content coding tools), so
// it gets a higher allocation to maintain text legibility.
const SCREENSHARE_BPP_VP9 = 0.05;
const SCREENSHARE_BPP_H264 = 0.15;
const SCREENSHARE_BITRATE_FLOOR = 1_500_000;   // 1.5 Mbps
const SCREENSHARE_BITRATE_CEILING = 20_000_000; // 20 Mbps

function screenShareBitrate(w: number, h: number, fps: number, codec: "vp9" | "h264" = "vp9"): number {
    const bpp = codec === "h264" ? SCREENSHARE_BPP_H264 : SCREENSHARE_BPP_VP9;
    const raw = Math.round(w * h * fps * bpp);
    return Math.min(SCREENSHARE_BITRATE_CEILING, Math.max(SCREENSHARE_BITRATE_FLOOR, raw));
}

/**
 * Publish options for screen share. Codec varies by platform:
 * - Windows: H.264 (Chromium's native getDisplayMedia, hardware-encoded).
 * - pipecap (Linux) / fallback: VP9 SVC — raw pixels encoded once by
 *   the browser. `backupCodec` is on by default → Safari / older
 *   Chromium get VP8 automatically.
 */
function buildScreenSharePublishOpts(
    encodingBitrate: number,
    encodeFps: number,
    codec: "vp9" | "h264" = "vp9",
): TrackPublishOptions {
    return {
        source: Track.Source.ScreenShare,
        videoCodec: codec,
        screenShareEncoding: { maxFramerate: encodeFps, maxBitrate: encodingBitrate },
    };
}

export async function startScreenShare(options: ScreenShareSettings): Promise<boolean> {
    if (!room) return false;

    const res = RESOLUTION_MAP[options.resolution];
    const encodeFps = options.frameRate;
    const resolution = res
        ? { ...res, frameRate: encodeFps }
        : { width: 3840, height: 2160, frameRate: encodeFps };

    const platform = getElectronAPI()?.platform;
    const isLinuxDesktop = isDesktop && platform === "linux";
    const isWindowsDesktop = isDesktop && platform === "win32";
    const usePipecap = isLinuxDesktop && !!getPipecapAPI();
    const useWinAudio = isWindowsDesktop && !!getWinAudioAPI();

    // Prefer H.264 for screen content on Windows (hardware-accelerated
    // in Chromium via D3D11VA and broadly supported by receivers).
    // Elsewhere, VP9 is the robust default.
    const screenCodec = useWinAudio ? "h264" as const : "vp9" as const;
    const encodingBitrate = screenShareBitrate(resolution.width, resolution.height, encodeFps, screenCodec);
    const publishOpts = buildScreenSharePublishOpts(encodingBitrate, encodeFps);

    // Windows: video comes from Chromium's native getDisplayMedia (single
    // hardware encode, zero IPC). Audio comes from @librecord/winaudio —
    // Chromium's getDisplayMedia can't capture per-process loopback on
    // Windows, and the system mix loops the Librecord voice call back to
    // remote participants as echo.
    let winAudioTrack: MediaStreamTrack | undefined;
    if (useWinAudio && options.audio) {
        const audioResult = await winaudio.startAudioOnly();
        if (audioResult) {
            winAudioTrack = audioResult.audioTrack;
        } else {
            showToast("Audio capture failed", "info");
        }
    }

    if (usePipecap) {
        // Linux: pipecap hands us real MediaStreamTracks; publish them
        // directly via publishTrack — no setScreenShareEnabled, no
        // getDisplayMedia monkey-patching.
        const result = await pipecapScreenShare.startCapture(encodeFps, options.audio);
        if (!result) return false;

        try {
            const videoTrack = new LocalVideoTrack(result.videoTrack, undefined, false);
            await room.localParticipant.publishTrack(videoTrack, publishOpts);

            // Tear the whole share down if the captured source ends (user
            // revoked the portal token, the window was closed, pipecap
            // process died, etc.). See the Windows branch for rationale.
            const onEnded = () => {
                result.videoTrack.removeEventListener("ended", onEnded);
                logger.voice.info("Screen share source ended — stopping share");
                stopScreenShare().catch(e =>
                    logger.voice.warn("stopScreenShare after source ended failed", e));
            };
            result.videoTrack.addEventListener("ended", onEnded);

            if (result.audioTrack) {
                const audioTrack = new LocalAudioTrack(result.audioTrack, undefined, false);
                // Explicit fmtp params matching the room defaults — see the
                // BUNDLE comment on `publishDefaults` for why.
                await room.localParticipant.publishTrack(audioTrack, {
                    source: Track.Source.ScreenShareAudio,
                    red: false,
                    dtx: false,
                    forceStereo: true,
                });
            }
        } catch (e) {
            logger.voice.warn("Pipecap screen share publish failed", e);
            pipecapScreenShare.stop();
            return false;
        }

        if (options.audio) {
            if (result.detectedApp) {
                showToast(`Sharing audio from ${result.detectedApp}`, "success");
            } else {
                showToast("Sharing system audio", "info");
            }
        }
    } else {
        // Windows/macOS/web: call getDisplayMedia ourselves and publish
        // each track with explicit fmtp opts. We can't use LiveKit's
        // setScreenShareEnabled here because its internal screen-share
        // audio defaults override our room-level publishDefaults, which
        // re-introduces the BUNDLE codec collision and kills the mic
        // mid-share. Doing it manually mirrors the Linux pipecap path.
        //
        // On Windows with winaudio available, audio is captured separately
        // via WASAPI process-loopback; we request video only here.
        const requestAudio = options.audio && !useWinAudio;
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: resolution.width },
                    height: { ideal: resolution.height },
                    frameRate: { ideal: encodeFps },
                },
                audio: requestAudio,
            });
        } catch (e) {
            logger.voice.warn("getDisplayMedia failed", e);
            // Clean up winaudio if we started it — it's useless without video.
            if (winAudioTrack) winaudio.stop();
            return false;
        }

        const videoMs = stream.getVideoTracks()[0];
        const audioMs = stream.getAudioTracks()[0];

        try {
            if (videoMs) {
                const videoTrack = new LocalVideoTrack(videoMs, undefined, false);
                await room.localParticipant.publishTrack(videoTrack, publishOpts);

                // Fires when the user closes the shared app/window, clicks
                // Chromium's "Stop sharing" toolbar, or the captured source
                // otherwise disappears. Tear the whole share down (video +
                // winaudio) in that case — keeping winaudio alive alone
                // would keep sending system audio to remote participants
                // with no visible screen and no way to stop it from the UI.
                const onEnded = () => {
                    videoMs.removeEventListener("ended", onEnded);
                    logger.voice.info("Screen share source ended — stopping share");
                    stopScreenShare().catch(e =>
                        logger.voice.warn("stopScreenShare after source ended failed", e));
                };
                videoMs.addEventListener("ended", onEnded);
            }
            // getDisplayMedia audio (non-Windows platforms).
            if (audioMs) {
                const audioTrack = new LocalAudioTrack(audioMs, undefined, false);
                await room.localParticipant.publishTrack(audioTrack, {
                    source: Track.Source.ScreenShareAudio,
                    red: false,
                    dtx: false,
                    forceStereo: true,
                });
            }
            // WinAudio (Windows hybrid path).
            if (winAudioTrack) {
                const audioTrack = new LocalAudioTrack(winAudioTrack, undefined, false);
                await room.localParticipant.publishTrack(audioTrack, {
                    source: Track.Source.ScreenShareAudio,
                    red: false,
                    dtx: false,
                    forceStereo: true,
                });
            }
        } catch (e) {
            logger.voice.warn("Screen share publish failed", e);
            stream.getTracks().forEach((t) => t.stop());
            if (winAudioTrack) winaudio.stop();
            return false;
        }

        // The user asked for audio but the OS / source didn't deliver one
        // (most commonly: Windows screen-source on a system that has no
        // per-source audio capture path, or macOS where getDisplayMedia
        // doesn't expose system audio at all). Tell them so they don't
        // wonder why participants can't hear them.
        if (options.audio && !audioMs && !winAudioTrack) {
            showToast("Audio capture is unavailable for this source", "info");
        }
    }

    // For a screenshare that's mostly games / high-motion, keeping the
    // framerate steady matters more than keeping every pixel. If WebRTC
    // has to degrade under bandwidth pressure we'd rather lose a bit of
    // resolution than stutter (which is what users perceive most). That
    // means:
    //   contentHint = "motion"            — tell the encoder this is
    //                                       video-like content, not text
    //   degradationPreference = "maintain-framerate"
    //                                     — drop pixels, not frames
    // If we ever want the old "text-legibility-first" behavior back we
    // should make it an explicit user choice in the picker, not the
    // default.
    try {
        room.localParticipant.videoTrackPublications.forEach(pub => {
            if (pub.source !== Track.Source.ScreenShare) return;
            const track = pub.track;
            if (!track?.mediaStreamTrack) return;
            track.mediaStreamTrack.contentHint = "motion";

            const sender = track.sender as RTCRtpSender | undefined;
            if (!sender) return;
            const params = sender.getParameters();
            params.degradationPreference = "maintain-framerate";
            for (const enc of params.encodings) {
                enc.maxBitrate = encodingBitrate;
                enc.maxFramerate = encodeFps;
            }
            sender.setParameters(params).catch((e) => {
                logger.voice.warn("Failed to apply screen-share sender params", e);
            });
        });
    } catch (e) {
        logger.voice.warn("Failed to set screen-share encoder hints", e);
    }

    return true;
}

// Always stop both winaudio and pipecap on screenshare stop. Only one
// can be active at a time, the other call is a cheap no-op.
export async function stopScreenShare(): Promise<boolean> {
    winaudio.stop();
    if (!room) return false;
    pipecapScreenShare.stop();

    // setScreenShareEnabled(false) only unpublishes tracks LiveKit knows
    // it created. The pipecap path uses publishTrack() directly, so we
    // have to unpublish those ourselves or every share→unshare cycle
    // leaks a publication on the SFU.
    const lp = room.localParticipant;
    const screenPubs = [
        ...lp.videoTrackPublications.values(),
        ...lp.audioTrackPublications.values(),
    ].filter(p =>
        p.source === Track.Source.ScreenShare ||
        p.source === Track.Source.ScreenShareAudio,
    );
    for (const pub of screenPubs) {
        if (pub.track) {
            try {
                await lp.unpublishTrack(pub.track, true);
            } catch (e) {
                logger.voice.warn("Failed to unpublish screen-share track", e);
            }
        }
    }

    // Also call the LiveKit-managed stop for the non-pipecap path.
    await lp.setScreenShareEnabled(false);
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
