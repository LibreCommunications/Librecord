import { useState } from "react";

export default function AppSettings() {
    const [desktopNotifs, setDesktopNotifs] = useState(() => {
        return localStorage.getItem("lr:desktop-notifs") !== "false";
    });
    const [notifSounds, setNotifSounds] = useState(() => {
        return localStorage.getItem("lr:notif-sounds") !== "false";
    });
    const [compactMode, setCompactMode] = useState(() => {
        return localStorage.getItem("lr:compact-mode") === "true";
    });

    function toggle(key: string, value: boolean, setter: (v: boolean) => void) {
        localStorage.setItem(key, String(value));
        setter(value);
    }

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-white">App Settings</h1>

            {/* Notifications */}
            <section>
                <h2 className="text-xs font-bold uppercase text-[#b5bac1] tracking-wide mb-4">
                    Notifications
                </h2>
                <div className="space-y-3">
                    <ToggleRow
                        label="Desktop Notifications"
                        description="Show desktop notifications for new messages when the app is in the background."
                        checked={desktopNotifs}
                        onChange={v => toggle("lr:desktop-notifs", v, setDesktopNotifs)}
                    />
                    <ToggleRow
                        label="Notification Sounds"
                        description="Play a sound when you receive a new message."
                        checked={notifSounds}
                        onChange={v => toggle("lr:notif-sounds", v, setNotifSounds)}
                    />
                </div>
            </section>

            {/* Appearance */}
            <section>
                <h2 className="text-xs font-bold uppercase text-[#b5bac1] tracking-wide mb-4">
                    Appearance
                </h2>
                <div className="space-y-3">
                    <ToggleRow
                        label="Compact Mode"
                        description="Reduce padding between messages for a denser view."
                        checked={compactMode}
                        onChange={v => toggle("lr:compact-mode", v, setCompactMode)}
                    />
                </div>
            </section>
        </div>
    );
}

function ToggleRow({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between bg-[#2b2d31] rounded-lg px-4 py-3">
            <div>
                <div className="text-sm font-medium text-white">{label}</div>
                <div className="text-xs text-[#949ba4] mt-0.5">{description}</div>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`
                    w-11 h-6 rounded-full relative transition-colors shrink-0
                    ${checked ? "bg-[#248046]" : "bg-[#72767d]"}
                `}
            >
                <span
                    className={`
                        block w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-200
                        absolute top-[3px]
                        ${checked ? "left-[23px]" : "left-[3px]"}
                    `}
                />
            </button>
        </div>
    );
}
