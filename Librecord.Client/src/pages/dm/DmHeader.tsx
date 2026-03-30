import { PersonPlusIcon, LoginArrowIcon, PhoneIcon } from "../../components/ui/Icons";

export function DmHeader({
                             channelName,
                             isGroup,
                             onAddMember,
                             onLeave,
                             onStartCall,
                             inCall,
                         }: {
    channelName: string | null;
    isGroup: boolean;
    onAddMember?: () => void;
    onLeave?: () => void;
    onStartCall?: () => void;
    inCall?: boolean;
}) {
    return (
        <div className="h-12 flex items-center justify-between px-4 border-b border-black/20 font-semibold">
            <span>{channelName ?? "Direct Message"}</span>

            <div className="flex gap-3 text-sm font-normal">
                {onStartCall && (
                    <button
                        onClick={onStartCall}
                        disabled={inCall}
                        className={`${inCall ? "text-green-400" : "text-gray-400 hover:text-green-400"} transition-colors disabled:cursor-default`}
                        title={inCall ? "In call" : "Start call"}
                    >
                        <PhoneIcon size={18} />
                    </button>
                )}
                {isGroup && onAddMember && (
                    <button onClick={onAddMember} className="text-gray-400 hover:text-white" title="Add member">
                        <PersonPlusIcon size={18} />
                    </button>
                )}
                {isGroup && onLeave && (
                    <button onClick={onLeave} className="text-gray-400 hover:text-red-400" title="Leave group">
                        <LoginArrowIcon size={18} />
                    </button>
                )}
            </div>
        </div>
    );
}
