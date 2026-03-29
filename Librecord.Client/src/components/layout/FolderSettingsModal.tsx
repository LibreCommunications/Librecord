import { useState } from "react";

interface FolderSettingsModalProps {
    folderId: string | null;
    initialName: string;
    initialColor: string;
    onSave: (name: string, color: string) => void;
    onClose: () => void;
}

export function FolderSettingsModal({ folderId, initialName, initialColor, onSave, onClose }: FolderSettingsModalProps) {
    const [name, setName] = useState(initialName);
    const [color, setColor] = useState(initialColor);

    if (!folderId) return null;

    return (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center" onClick={onClose}>
            <div className="bg-[#313338] rounded-lg p-5 w-[340px] shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-white mb-3">Folder Settings</h2>

                <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1">Name</label>
                <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { onSave(name, color); } }}
                    maxLength={32}
                    placeholder="Folder name"
                    className="w-full px-3 py-2 rounded bg-[#1e1f22] text-white outline-none border border-[#3f4147] focus:border-[#5865F2] mb-3"
                />

                <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1">Color</label>
                <div className="flex items-center gap-3 mb-1">
                    <input
                        type="color"
                        value={color || "#5865F2"}
                        onChange={e => setColor(e.target.value)}
                        className="w-10 h-10 rounded-full border-0 cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/20 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-2 [&::-moz-color-swatch]:border-white/20"
                    />
                    <span className="text-sm text-[#949ba4] font-mono">{(color || "#5865F2").toUpperCase()}</span>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-white hover:underline">Cancel</button>
                    <button
                        onClick={() => { onSave(name, color); }}
                        className="px-4 py-1.5 rounded bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-medium"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
