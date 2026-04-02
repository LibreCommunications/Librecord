export function MessageMenuButton({
                                      open,
                                      onClick
                                  }: {
    open: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={e => {
                e.stopPropagation();
                onClick();
            }}
            className={`
                absolute top-2 right-2 w-8 h-8 rounded-full
                flex items-center justify-center transition
                ${open
                ? "bg-[#3a3c43] text-white"
                : "opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-[#3a3c43] hover:text-white"}
            `}
        >
            <span className="text-xl leading-none">⋯</span>
        </button>
    );
}
