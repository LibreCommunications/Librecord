import { Track } from "livekit-client";
import type { TrackProcessor, AudioProcessorOptions } from "livekit-client";

export function createRNNoiseProcessor(): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let workletNode: AudioWorkletNode | null = null;
    let dest: MediaStreamAudioDestinationNode | null = null;
    let _processedTrack: MediaStreamTrack | undefined;

    async function buildGraph(track: MediaStreamTrack, audioContext: AudioContext) {
        // RNNoise requires 48kHz. If the provided context isn't 48kHz,
        // create our own. Otherwise reuse.
        if (audioContext.sampleRate === 48000) {
            ctx = audioContext;
        } else {
            ctx = new AudioContext({ sampleRate: 48000 });
        }

        await ctx.audioWorklet.addModule("/rnnoise-worklet.js");

        const stream = new MediaStream([track]);
        source = ctx.createMediaStreamSource(stream);
        workletNode = new AudioWorkletNode(ctx, "rnnoise-processor", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
        });
        dest = ctx.createMediaStreamDestination();

        source.connect(workletNode);
        workletNode.connect(dest);

        _processedTrack = dest.stream.getAudioTracks()[0];
    }

    function teardownGraph(providedCtx?: AudioContext) {
        source?.disconnect();
        workletNode?.disconnect();
        dest?.disconnect();
        // Only close the AudioContext if we created our own
        if (ctx && ctx !== providedCtx) {
            ctx.close().catch(() => {});
        }
        source = null;
        workletNode = null;
        dest = null;
        ctx = null;
        _processedTrack = undefined;
    }

    const processor: TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> = {
        name: "rnnoise",

        get processedTrack() { return _processedTrack; },

        async init(opts: AudioProcessorOptions) {
            await buildGraph(opts.track, opts.audioContext);
        },

        async restart(opts: AudioProcessorOptions) {
            teardownGraph(opts.audioContext);
            await buildGraph(opts.track, opts.audioContext);
        },

        async destroy() {
            teardownGraph();
        },
    };

    return processor;
}
