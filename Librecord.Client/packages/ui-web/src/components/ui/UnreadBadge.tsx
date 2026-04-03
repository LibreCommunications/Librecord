interface Props {
    count: number;
}

export function UnreadBadge({ count }: Props) {
    if (count <= 0) return null;

    const display = count > 99 ? "99+" : String(count);

    return (
        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1" data-testid="unread-badge">
            {display}
        </span>
    );
}
