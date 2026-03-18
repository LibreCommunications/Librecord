import { useState } from "react";
import { Spinner } from "./Spinner";

interface Props {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    confirmVariant?: "danger" | "primary";
    onConfirm: () => Promise<void> | void;
    onCancel: () => void;
}

export function ConfirmModal({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    confirmVariant = "danger",
    onConfirm,
    onCancel,
}: Props) {
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    async function handleConfirm() {
        setLoading(true);
        try {
            await onConfirm();
        } finally {
            setLoading(false);
        }
    }

    const confirmClass =
        confirmVariant === "danger"
            ? "bg-[#da373c] hover:bg-[#a12828]"
            : "bg-[#5865F2] hover:bg-[#4752C4]";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-[fadeIn_0.15s_ease-out]"
            onClick={onCancel}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="w-[440px] bg-[#313338] rounded-lg shadow-xl overflow-hidden animate-[scaleIn_0.15s_ease-out]"
            >
                <div className="p-4">
                    <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
                    <p className="text-sm text-[#b5bac1]">{description}</p>
                </div>

                <div className="flex justify-end gap-3 px-4 py-3 bg-[#2b2d31]">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="px-4 py-2 text-sm text-white hover:underline"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className={`
                            px-4 py-2 rounded text-sm font-medium text-white
                            disabled:opacity-50 flex items-center gap-2
                            transition-colors ${confirmClass}
                        `}
                    >
                        {loading && <Spinner size="sm" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
