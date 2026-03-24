import { useState } from "react";
import { Spinner } from "../../components/ui/Spinner";

interface Props {
    open: boolean;
    username: string;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export default function RemoveFriendModal({
                                              open,
                                              username,
                                              onClose,
                                              onConfirm
                                          }: Props) {
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    async function handleConfirm() {
        if (loading) return;
        setLoading(true);
        await onConfirm();
        setLoading(false);
    }

    return (
        <div
            className="modal-overlay-animated"
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="w-[440px] modal-card-animated"
            >
                <div className="p-4">
                    <h2 className="text-xl font-semibold text-white mb-2">
                        Remove Friend
                    </h2>
                    <p className="text-sm text-[#b5bac1]">
                        Are you sure you want to remove{" "}
                        <span className="font-semibold text-white">{username}</span>?
                        You will no longer be able to message each other.
                    </p>
                </div>

                <div className="flex justify-end gap-3 px-4 py-3 bg-[#2b2d31]">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm text-white hover:underline"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="px-4 py-2 rounded text-sm font-medium bg-[#da373c] hover:bg-[#a12828] text-white disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {loading && <Spinner size="sm" />}
                        Remove Friend
                    </button>
                </div>
            </div>
        </div>
    );
}
