import { useCallback, useEffect, useState } from "react";
import * as livekitClient from "../../voice/livekitClient";

export default function AppSettings() {
    const [desktopNotifs, setDesktopNotifs] = useState(() => {
        return localStorage.getItem("lr:desktop-notifs") !== "false";
    });
    const [notifSounds, setNotifSounds] = useState(() => {
        return localStorage.getItem("lr:notif-sounds") !== "false";
    });
    function toggle(key: string, value: boolean, setter: (v: boolean) => void) {
        localStorage.setItem(key, String(value));
        setter(value);
    }

    // ── Device selection ─────────────────────────────────────
    const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
    const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
    const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
    const [prefs, setPrefs] = useState(livekitClient.getAllDevicePrefs);

    const loadDevices = useCallback(async () => {
        // Request permission so labels are populated
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            stream.getTracks().forEach(t => t.stop());
        } catch { /* user may deny — labels will be empty but IDs still work */ }

        setAudioInputs(await livekitClient.listAudioInputDevices());
        setAudioOutputs(await livekitClient.listAudioOutputDevices());
        setVideoInputs(await livekitClient.listVideoDevices());
    }, []);

    useEffect(() => { loadDevices(); }, [loadDevices]);

    function selectDevice(kind: "audioinput" | "videoinput" | "audiooutput", deviceId: string) {
        livekitClient.setDevicePref(kind, deviceId);
        setPrefs(livekitClient.getAllDevicePrefs());
    }

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-white">App Settings</h1>

            {/* Notifications */}
            <section>
                <h2 className="section-label mb-4">Notifications</h2>
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

            {/* Voice & Video */}
            <section>
                <h2 className="section-label mb-4">Voice & Video</h2>
                <div className="space-y-3">
                    <DeviceSelect
                        label="Microphone"
                        devices={audioInputs}
                        selected={prefs.audioinput}
                        onChange={id => selectDevice("audioinput", id)}
                    />
                    <DeviceSelect
                        label="Speaker / Output"
                        devices={audioOutputs}
                        selected={prefs.audiooutput}
                        onChange={id => selectDevice("audiooutput", id)}
                    />
                    <DeviceSelect
                        label="Camera"
                        devices={videoInputs}
                        selected={prefs.videoinput}
                        onChange={id => selectDevice("videoinput", id)}
                    />
                </div>
                <p className="text-xs text-[#949ba4] mt-3">
                    Changes apply the next time you join a voice channel.
                </p>
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

function DeviceSelect({
    label,
    devices,
    selected,
    onChange,
}: {
    label: string;
    devices: MediaDeviceInfo[];
    selected?: string;
    onChange: (deviceId: string) => void;
}) {
    return (
        <div className="bg-[#2b2d31] rounded-lg px-4 py-3">
            <label className="text-sm font-medium text-white block mb-2">{label}</label>
            <select
                value={selected ?? ""}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-[#1e1f22] text-[#dbdee1] text-sm rounded px-3 py-2 outline-none border border-[#3f4147] focus:border-[#5865F2] transition-colors"
            >
                <option value="">System Default</option>
                {devices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Device ${d.deviceId.slice(0, 8)}`}
                    </option>
                ))}
            </select>
        </div>
    );
}
