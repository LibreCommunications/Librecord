export function DmHeader({
                             channelName,
                             onAdd,
                             onLeave
                         }: {
    channelName: string | null;
    onAdd: () => void;
    onLeave: () => void;
}) {
    return (
        <div className="h-12 flex items-center justify-between px-4 border-b border-black/20 font-semibold">
            <span>{channelName ?? "Direct Message"}</span>

            <div className="flex gap-4 text-sm font-normal">
                <button onClick={onAdd} className="text-gray-400 hover:text-white">
                    Add friend
                </button>
                <button onClick={onLeave} className="text-red-400 hover:text-red-300">
                    Leave
                </button>
            </div>
        </div>
    );
}
