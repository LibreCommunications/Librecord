interface Props {
    typingNames: string[];
}

export function TypingIndicator({ typingNames }: Props) {
    if (typingNames.length === 0) return null;

    let text: string;
    if (typingNames.length === 1) {
        text = `${typingNames[0]} is typing...`;
    } else if (typingNames.length === 2) {
        text = `${typingNames[0]} and ${typingNames[1]} are typing...`;
    } else {
        text = "Several people are typing...";
    }

    return (
        <div className="h-6 px-4 text-xs text-gray-400 flex items-center gap-1.5">
            <span className="inline-flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            <span>{text}</span>
        </div>
    );
}
