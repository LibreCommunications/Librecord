interface Props {
    status: string;
    size?: "sm" | "md";
}

const colorMap: Record<string, string> = {
    online: "bg-green-500",
    idle: "bg-yellow-500",
    donotdisturb: "bg-red-500",
    dnd: "bg-red-500",
    offline: "bg-gray-500",
};

const sizeMap = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
};

export function StatusDot({ status, size = "sm" }: Props) {
    const color = colorMap[status.toLowerCase()] ?? colorMap.offline;

    return (
        <span
            className={`${sizeMap[size]} ${color} rounded-full border-2 border-[#2b2d31] inline-block`}
        />
    );
}
