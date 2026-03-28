import { useEffect, useImperativeHandle, useRef, useState } from "react";

interface Props {
    files: File[];
    onFilesChange: (files: File[]) => void;
    onReject?: (fileNames: string[]) => void;
    triggerRef?: React.Ref<{ open: () => void }>;
}

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

export function AttachmentUpload({ files, onFilesChange, onReject, triggerRef }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    const [urlState, setUrlState] = useState<{ files: File[]; urls: Map<File, string> }>({
        files: [],
        urls: new Map(),
    });

    let previewUrls = urlState.urls;
    if (files !== urlState.files) {
        const next = reconcileUrls(urlState.urls, files);
        previewUrls = next;
        setUrlState({ files, urls: next });
    }

    useEffect(() => {
        return () => {
            setUrlState(prev => {
                for (const url of prev.urls.values()) URL.revokeObjectURL(url);
                return prev;
            });
        };
    }, []);

    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

    function handleFiles(newFiles: FileList | null) {
        if (!newFiles) return;
        const accepted: File[] = [];
        const rejected: string[] = [];
        for (const file of Array.from(newFiles)) {
            if (file.size > MAX_FILE_SIZE) {
                rejected.push(file.name);
            } else {
                accepted.push(file);
            }
        }
        if (rejected.length > 0) {
            onReject?.(rejected);
        }
        if (accepted.length > 0) {
            onFilesChange([...files, ...accepted]);
        }
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

    useImperativeHandle(triggerRef, () => ({ open }));

    return (
        <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
        >
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
