interface Props {
    icon?: string;
    title: string;
    description?: string;
}

const illustrations: Record<string, React.ReactNode> = {
    // Chat bubbles
    "\uD83D\uDCAC": (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="12" width="44" height="32" rx="8" fill="#5865F2" fillOpacity="0.2" stroke="#5865F2" strokeWidth="2" strokeOpacity="0.5" />
            <circle cx="22" cy="28" r="2.5" fill="#5865F2" fillOpacity="0.6" />
            <circle cx="30" cy="28" r="2.5" fill="#5865F2" fillOpacity="0.6" />
            <circle cx="38" cy="28" r="2.5" fill="#5865F2" fillOpacity="0.6" />
            <path d="M16 44L12 54L26 48" fill="#5865F2" fillOpacity="0.2" stroke="#5865F2" strokeWidth="2" strokeOpacity="0.5" />
            <rect x="28" y="30" width="44" height="28" rx="8" fill="#5865F2" fillOpacity="0.1" stroke="#5865F2" strokeWidth="2" strokeOpacity="0.25" />
        </svg>
    ),
    // Search
    "\uD83D\uDD0D": (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="34" cy="34" r="20" stroke="#5865F2" strokeWidth="2.5" strokeOpacity="0.5" />
            <circle cx="34" cy="34" r="12" stroke="#5865F2" strokeWidth="1.5" strokeOpacity="0.2" />
            <line x1="49" y1="49" x2="64" y2="64" stroke="#5865F2" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.5" />
        </svg>
    ),
    // Pin
    "\uD83D\uDCCC": (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M40 16L48 32H32L40 16Z" fill="#5865F2" fillOpacity="0.2" stroke="#5865F2" strokeWidth="2" strokeOpacity="0.5" />
            <rect x="36" y="32" width="8" height="20" rx="2" fill="#5865F2" fillOpacity="0.15" stroke="#5865F2" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="40" y1="52" x2="40" y2="64" stroke="#5865F2" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4" />
        </svg>
    ),
};

export function EmptyState({ icon, title, description }: Props) {
    const illustration = icon ? illustrations[icon] : null;

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none animate-[fadeIn_0.3s_ease-out]">
            {illustration ? (
                <div className="mb-5 opacity-80">{illustration}</div>
            ) : icon ? (
                <div className="text-5xl mb-4 opacity-40">{icon}</div>
            ) : null}
            <h3 className="text-xl font-semibold text-[#b5bac1] mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-[#949ba4] max-w-xs">{description}</p>
            )}
        </div>
    );
}
