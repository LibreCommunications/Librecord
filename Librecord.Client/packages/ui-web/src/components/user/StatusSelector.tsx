import { useState } from "react";
import { presence } from "@librecord/api-client";
import { StatusDot } from "./StatusDot";

const statuses = [
    { value: "online", label: "Online" },
    { value: "idle", label: "Idle" },
    { value: "donotdisturb", label: "Do Not Disturb" },
    { value: "offline", label: "Invisible" },
] as const;

interface Props {
    currentStatus: string;
    onStatusChange: (status: string) => void;
}

export function StatusSelector({ currentStatus, onStatusChange }: Props) {
    const [open, setOpen] = useState(false);

    async function handleSelect(status: string) {
        setOpen(false);

        await presence.set(status);

        onStatusChange(status);
    }

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white"
            >
                <StatusDot status={currentStatus} size="md" />
                <span className="capitalize">
                    {statuses.find(s => s.value === currentStatus)?.label ?? "Online"}
                </span>
            </button>

            {open && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="fixed z-50" style={{ bottom: "80px", left: "16px" }}>
                    <div className="bg-[#111214] rounded-lg shadow-xl py-1.5 w-48 border border-[#2b2d31] animate-[scaleIn_0.1s_ease-out]">
                        {statuses.map(s => (
                            <button
                                key={s.value}
                                onClick={() => handleSelect(s.value)}
                                className={`
                                    w-full px-3 py-1.5 text-left text-sm flex items-center gap-2
                                    hover:bg-[#5865F2] hover:text-white transition-colors
                                    ${currentStatus === s.value ? "text-white bg-[#5865F2]/20" : "text-[#b5bac1]"}
                                `}
                            >
                                <StatusDot status={s.value} />
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
                </>
            )}
        </div>
    );
}
