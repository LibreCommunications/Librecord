import { useEffect, useRef } from "react";

interface Props {
    files: File[];
    onFilesChange: (files: File[]) => void;
    triggerRef?: React.Ref<{ open: () => void }>;
}

export function AttachmentUpload({ files, onFilesChange, triggerRef }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Create and track object URLs — revoke on cleanup or file change
    const urlMapRef = useRef(new Map<File, string>());

    function getPreviewUrl(file: File): string {
        if (!urlMapRef.current.has(file)) {
            urlMapRef.current.set(file, URL.createObjectURL(file));
        }
        return urlMapRef.current.get(file)!;
    }

    useEffect(() => {
        const map = urlMapRef.current;
        // Revoke URLs for files that were removed
        for (const [file, url] of map) {
            if (!files.includes(file)) {
                URL.revokeObjectURL(url);
                map.delete(file);
            }
        }
    }, [files]);

    // Revoke all on unmount
    useEffect(() => {
        const map = urlMapRef.current;
        return () => {
            for (const url of map.values()) URL.revokeObjectURL(url);
            map.clear();
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
    if (triggerRef && typeof triggerRef === "object" && triggerRef !== null) {
        (triggerRef as React.MutableRefObject<{ open: () => void }>).current = { open };
    }

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
                                    src={getPreviewUrl(file)}
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
