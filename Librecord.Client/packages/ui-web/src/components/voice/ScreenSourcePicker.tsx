import { useState, useEffect, useCallback } from "react";
import { getElectronAPI, isDesktop, type ScreenShareSource } from "@librecord/domain";

export function ScreenSourcePicker() {
    const [sources, setSources] = useState<ScreenShareSource[] | null>(null);

    useEffect(() => {
        if (!isDesktop) return;
        const unsubscribe = getElectronAPI()!.onScreenSharePick((incoming) => {
            setSources(incoming);
        });
        return unsubscribe;
    }, []);

    const select = useCallback((sourceId: string) => {
        getElectronAPI()!.selectScreenShareSource(sourceId);
        setSources(null);
    }, []);

    const cancel = useCallback(() => {
        getElectronAPI()!.cancelScreenSharePick();
        setSources(null);
    }, []);

    if (!sources) return null;

    const screens = sources.filter(s => s.id.startsWith("screen:"));
    const windows = sources.filter(s => s.id.startsWith("window:"));

    return (
        <div className="modal-overlay-animated" onClick={cancel}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-[720px] max-h-[80vh] mx-4 modal-card-animated flex flex-col"
            >
                <div className="p-5 pb-0 shrink-0">
                    <h2 className="text-xl font-semibold text-white">
                        Choose what to share
                    </h2>
                    <p className="text-sm text-[#b5bac1] mt-1">
                        Select a screen or window to share.
                    </p>
                </div>

                <div className="p-5 space-y-5 overflow-y-auto min-h-0">
                    {screens.length > 0 && (
                        <SourceSection
                            label="Screens"
                            sources={screens}
                            onSelect={select}
                        />
                    )}
                    {windows.length > 0 && (
                        <SourceSection
                            label="Windows"
                            sources={windows}
                            onSelect={select}
                        />
                    )}
                </div>

                <div className="flex justify-end px-5 py-4 bg-[#2b2d31] shrink-0">
                    <button
                        onClick={cancel}
                        className="px-4 py-2 text-sm text-white hover:underline"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

function SourceSection({
    label,
    sources,
    onSelect,
}: {
    label: string;
    sources: ScreenShareSource[];
    onSelect: (id: string) => void;
}) {
    return (
        <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-3">
                {label}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sources.map((source) => (
                    <button
                        key={source.id}
                        onClick={() => onSelect(source.id)}
                        className="group flex flex-col rounded-lg border-2 border-[#3f4147] bg-[#2b2d31] hover:border-[#5865F2] transition-colors overflow-hidden text-left"
                    >
                        <div className="relative w-full aspect-video bg-black">
                            <img
                                src={source.thumbnailDataUrl}
                                alt={source.name}
                                className="w-full h-full object-contain"
                                draggable={false}
                            />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 min-w-0">
                            {source.appIconDataUrl && (
                                <img
                                    src={source.appIconDataUrl}
                                    alt=""
                                    className="w-4 h-4 shrink-0"
                                    draggable={false}
                                />
                            )}
                            <span className="text-xs text-[#dbdee1] group-hover:text-white truncate transition-colors">
                                {source.name}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
