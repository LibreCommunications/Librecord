const VOLUME = 0.4;

/**
 * Generate a tiny WAV file (mono, 22050 Hz, 8-bit) from sample data.
 * Returns a data URI that can be played with `new Audio(uri).play()`.
 */
function makeWav(samples: Uint8Array, sampleRate = 22050): string {
    const numSamples = samples.length;
    const byteRate = sampleRate;
    const buf = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buf);

    writeStr(view, 0, "RIFF");
    view.setUint32(4, 36 + numSamples, true);
    writeStr(view, 8, "WAVE");

    writeStr(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);

    writeStr(view, 36, "data");
    view.setUint32(40, numSamples, true);

    const bytes = new Uint8Array(buf);
    bytes.set(samples, 44);

    const blob = new Blob([buf], { type: "audio/wav" });
    return URL.createObjectURL(blob);
}

function writeStr(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

function synth(opts: {
    freq: number | ((t: number) => number);
    duration: number;
    attack?: number;
    decay?: number;
    volume?: number;
    sampleRate?: number;
}): Uint8Array {
    const sr = opts.sampleRate ?? 22050;
    const len = Math.floor(sr * opts.duration);
    const attack = opts.attack ?? 0.005;
    const decay = opts.decay ?? opts.duration * 0.6;
    const vol = opts.volume ?? 0.8;
    const samples = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        const t = i / sr;
        const freq = typeof opts.freq === "function" ? opts.freq(t) : opts.freq;
        const sample = Math.sin(2 * Math.PI * freq * t);

        let env = 1;
        if (t < attack) {
            env = t / attack;
        } else {
            const decayStart = opts.duration - decay;
            if (t > decayStart) {
                env = Math.max(0, 1 - (t - decayStart) / decay);
                env = env * env;
            }
        }

        // 8-bit unsigned: 128 is silence, 0-255 is range
        samples[i] = Math.round(128 + sample * env * vol * 127);
    }
    return samples;
}

const joinWav = makeWav(
    synth({
        freq: (t) => 420 + t * 2000,
        duration: 0.08,
        attack: 0.003,
        decay: 0.05,
        volume: 0.6,
    }),
);

const leaveWav = makeWav(
    synth({
        freq: (t) => 520 - t * 2200,
        duration: 0.08,
        attack: 0.003,
        decay: 0.05,
        volume: 0.6,
    }),
);

const streamStartWav = (() => {
    const sr = 22050;
    const note1 = synth({ freq: 523, duration: 0.12, attack: 0.005, decay: 0.08, volume: 0.5, sampleRate: sr });
    const gap = Math.floor(sr * 0.06);
    const note2 = synth({ freq: 659, duration: 0.14, attack: 0.005, decay: 0.1, volume: 0.5, sampleRate: sr });
    const combined = new Uint8Array(note1.length + gap + note2.length);
    combined.set(note1, 0);
    // Gap is silence (128 for 8-bit unsigned)
    combined.fill(128, note1.length, note1.length + gap);
    combined.set(note2, note1.length + gap);
    return makeWav(combined, sr);
})();

const streamStopWav = makeWav(
    synth({
        freq: (t) => 580 - t * 1200,
        duration: 0.15,
        attack: 0.005,
        decay: 0.12,
        volume: 0.5,
    }),
);

function play(uri: string) {
    const audio = new Audio(uri);
    audio.volume = VOLUME;
    audio.play().catch(() => {
        // Autoplay blocked — fine, it's just SFX
    });
}

let ringtoneAudio: HTMLAudioElement | null = null;

export function playRingtone() {
    stopRingtone();
    ringtoneAudio = new Audio("/sounds/call.mp3");
    ringtoneAudio.loop = true;
    ringtoneAudio.volume = VOLUME;
    ringtoneAudio.play().catch(() => {});
}

export function stopRingtone() {
    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
        ringtoneAudio = null;
    }
}

export function playJoinSound() { play(joinWav); }
export function playLeaveSound() { play(leaveWav); }
export function playStreamStartSound() { play(streamStartWav); }
export function playStreamStopSound() { play(streamStopWav); }
