interface Props {
    icon?: string;
    title: string;
    description?: string;
}

export function EmptyState({ icon, title, description }: Props) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
            {icon && (
                <div className="text-5xl mb-4 opacity-40">{icon}</div>
            )}
            <h3 className="text-xl font-semibold text-[#b5bac1] mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-[#949ba4] max-w-xs">{description}</p>
            )}
        </div>
    );
}
