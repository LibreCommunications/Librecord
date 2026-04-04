import { useState } from "react";
import { ScreenShareIcon } from "./VoiceIcons";

export interface ScreenShareOptions {
    resolution: "720p" | "1080p" | "1440p" | "source";
    frameRate: 15 | 30 | 60;
    audio: boolean;
}

const RESOLUTION_LABELS: Record<ScreenShareOptions["resolution"], string> = {
    "720p": "720p",
    "1080p": "1080p",
    "1440p": "1440p",
    source: "Source",
};

const RESOLUTION_DESCRIPTIONS: Record<ScreenShareOptions["resolution"], string> = {
    "720p": "Smoother for viewers",
    "1080p": "Balanced quality",
    "1440p": "High quality",
    source: "Native resolution",
};

interface Props {
    open: boolean;
    onStart: (options: ScreenShareOptions) => void;
    onCancel: () => void;
}

const isDesktop = !!window.electronAPI;

export function ScreenShareModal({ open, onStart, onCancel }: Props) {
    const [resolution, setResolution] = useState<ScreenShareOptions["resolution"]>("1080p");
    const [frameRate, setFrameRate] = useState<ScreenShareOptions["frameRate"]>(30);
    const [audio, setAudio] = useState(isDesktop);

    if (!open) return null;

    return (
        <div className="modal-overlay-animated" onClick={onCancel}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-[480px] mx-4 modal-card-animated"
            >
                <div className="p-5 pb-0">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 rounded-lg bg-[#5865F2]/15">
                            <ScreenShareIcon size={22} />
                        </div>
                        <h2 className="text-xl font-semibold text-white">
                            Screen Share
                        </h2>
                    </div>
                    <p className="text-sm text-[#b5bac1] mt-2">
                        Choose your stream quality settings before sharing.
                    </p>
                </div>

                <div className="p-5 space-y-5">
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2 block">
                            Stream Quality
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {(Object.keys(RESOLUTION_LABELS) as ScreenShareOptions["resolution"][]).map(
                                (res) => (
                                    <button
                                        key={res}
                                        onClick={() => setResolution(res)}
                                        className={`
                                            flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors
                                            ${
                                                resolution === res
                                                    ? "border-[#5865F2] bg-[#5865F2]/10"
                                                    : "border-[#3f4147] bg-[#2b2d31] hover:border-[#4e5058]"
                                            }
                                        `}
                                    >
                                        <span
                                            className={`text-sm font-semibold ${
                                                resolution === res
                                                    ? "text-white"
                                                    : "text-[#dbdee1]"
                                            }`}
                                        >
                                            {RESOLUTION_LABELS[res]}
                                        </span>
                                        <span className="text-[10px] text-[#949ba4] leading-tight text-center">
                                            {RESOLUTION_DESCRIPTIONS[res]}
                                        </span>
                                    </button>
                                ),
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2 block">
                            Frame Rate
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {([15, 30, 60] as const).map((fps) => (
                                <button
                                    key={fps}
                                    onClick={() => setFrameRate(fps)}
                                    className={`
                                        py-2.5 rounded-lg border-2 transition-colors text-sm font-medium
                                        ${
                                            frameRate === fps
                                                ? "border-[#5865F2] bg-[#5865F2]/10 text-white"
                                                : "border-[#3f4147] bg-[#2b2d31] hover:border-[#4e5058] text-[#dbdee1]"
                                        }
                                    `}
                                >
                                    {fps} FPS
                                </button>
                            ))}
                        </div>
                    </div>

                    {isDesktop && (
                        <div
                            className="flex items-center justify-between p-3 rounded-lg bg-[#2b2d31] cursor-pointer"
                            onClick={() => setAudio(!audio)}
                        >
                            <div>
                                <div className="text-sm font-medium text-[#dbdee1]">
                                    Share Audio
                                </div>
                                <div className="text-xs text-[#949ba4]">
                                    Include system audio in your stream
                                </div>
                            </div>
                            <div
                                className={`
                                    w-10 h-6 rounded-full relative transition-colors cursor-pointer
                                    ${audio ? "bg-[#5865F2]" : "bg-[#4e5058]"}
                                `}
                            >
                                <div
                                    className={`
                                        absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                                        ${audio ? "translate-x-5" : "translate-x-1"}
                                    `}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 px-5 py-4 bg-[#2b2d31]">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-white hover:underline"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onStart({ resolution, frameRate, audio })}
                        className="px-5 py-2 rounded text-sm font-medium text-white bg-[#5865F2] hover:bg-[#4752c4] transition-colors"
                    >
                        Go Live
                    </button>
                </div>
            </div>
        </div>
    );
}
