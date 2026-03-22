import { useEffect, useImperativeHandle, useRef, useState } from "react";

interface Props {
    files: File[];
    onFilesChange: (files: File[]) => void;
    triggerRef?: React.Ref<{ open: () => void }>;
}

/**
 * Build a Map<File, objectURL> reusing existing URLs where possible.
 * Revokes URLs for files no longer present.
 */
function reconcileUrls(
    prev: Map<File, string>,
    files: File[],
): Map<File, string> {
    const next = new Map<File, string>();
    for (const file of files) {
        next.set(file, prev.get(file) ?? URL.createObjectURL(file));
    }
    for (const [file, url] of prev) {
        if (!next.has(file)) URL.revokeObjectURL(url);
    }
    return next;
}

export function AttachmentUpload({ files, onFilesChange, triggerRef }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Track which files array we last computed URLs for
    const [urlState, setUrlState] = useState<{ files: File[]; urls: Map<File, string> }>({
        files: [],
        urls: new Map(),
    });

    // Synchronize preview URLs when files change (runs during render, no effect needed)
    let previewUrls = urlState.urls;
    if (files !== urlState.files) {
        const next = reconcileUrls(urlState.urls, files);
        previewUrls = next;
        // Schedule state update — this is fine because we're computing derived state
        // from changed props (the "if changed" pattern recommended by React docs)
        setUrlState({ files, urls: next });
    }

    // Revoke all on unmount
    useEffect(() => {
        return () => {
            // Read the latest state at unmount time via the setter
            setUrlState(prev => {
                for (const url of prev.urls.values()) URL.revokeObjectURL(url);
                return prev;
            });
        };
    }, []);

    function handleFiles(newFiles: FileList | null) {
        if (!newFiles) return;
        onFilesChange([...files, ...Array.from(newFiles)]);
    }

    function handleRemove(index: number) {
        onFilesChange(files.filter((_, i) => i !== index));
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    }

    function open() {
        inputRef.current?.click();
    }

    // Expose open() to parent via ref
    useImperativeHandle(triggerRef, () => ({ open }));

    return (
        <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
        >
            {/* File previews */}
            {files.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap px-4">
                    {files.map((file, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-1.5 bg-[#2b2d31] border border-[#3f4147] rounded-lg px-3 py-2 text-xs text-gray-300"
                        >
                            {file.type.startsWith("image/") ? (
                                <img
                                    src={previewUrls.get(file)}
                                    className="w-10 h-10 rounded object-cover"
                                    alt=""
                                />
                            ) : (
                                <span className="text-gray-400">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                </span>
                            )}
                            <span className="max-w-[120px] truncate">{file.name}</span>
                            <button
                                onClick={() => handleRemove(i)}
                                className="text-gray-500 hover:text-red-400 ml-1"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
            />
        </div>
    );
}
