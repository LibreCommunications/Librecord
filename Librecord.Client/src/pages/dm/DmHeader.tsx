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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <line x1="20" y1="8" x2="20" y2="14" />
                                <line x1="23" y1="11" x2="17" y2="11" />
                            </svg>
                        </button>
                    )}
                    {onLeave && (
                        <button onClick={onLeave} className="text-gray-400 hover:text-red-400" title="Leave group">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
