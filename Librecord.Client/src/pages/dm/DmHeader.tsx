import { PersonPlusIcon, LoginArrowIcon } from "../../components/ui/Icons";

export function DmHeader({
                             channelName,
                             isGroup,
                             onAddMember,
                             onLeave
                         }: {
    channelName: string | null;
    isGroup: boolean;
    onAddMember?: () => void;
    onLeave?: () => void;
}) {
    return (
        <div className="h-12 flex items-center justify-between px-4 border-b border-black/20 font-semibold">
            <span>{channelName ?? "Direct Message"}</span>

            {isGroup && (
                <div className="flex gap-3 text-sm font-normal">
                    {onAddMember && (
                        <button onClick={onAddMember} className="text-gray-400 hover:text-white" title="Add member">
                            <PersonPlusIcon size={18} />
                        </button>
                    )}
                    {onLeave && (
                        <button onClick={onLeave} className="text-gray-400 hover:text-red-400" title="Leave group">
                            <LoginArrowIcon size={18} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
