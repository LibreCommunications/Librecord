import { memo } from "react";

export const DateSeparator = memo(function DateSeparator({ date }: { date: string }) {
    const formatted = new Date(date).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <div className="flex items-center gap-2 px-4 py-2 mt-2">
            <div className="flex-1 h-px bg-[#3f4147]" />
            <span className="text-xs font-semibold text-[#949ba4] shrink-0">
                {formatted}
            </span>
            <div className="flex-1 h-px bg-[#3f4147]" />
        </div>
    );
});
