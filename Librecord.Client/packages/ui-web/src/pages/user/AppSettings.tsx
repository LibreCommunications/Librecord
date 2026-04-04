import { useState, useEffect, useRef } from "react";
import { STORAGE, isDesktop, getElectronAPI } from "@librecord/domain";
import { API_URL } from "@librecord/api-client";

export default function AppSettings() {
    const [desktopNotifs, setDesktopNotifs] = useState(() => {
        return localStorage.getItem(STORAGE.desktopNotifs) !== "false";
    });
    const [notifSounds, setNotifSounds] = useState(() => {
        return localStorage.getItem(STORAGE.notifSounds) !== "false";
    });
    const [devMode, setDevMode] = useState(() => {
        return localStorage.getItem(STORAGE.devMode) === "true";
    });

    const [autostart, setAutostart] = useState(false);
    const [minimizeToTray, setMinimizeToTray] = useState(true);
    const [appVersion, setAppVersion] = useState<string | null>(null);
    const [apiUrl, setApiUrl] = useState(() => localStorage.getItem(STORAGE.apiUrl) ?? "");
    const savedApiUrl = useRef(apiUrl);

    useEffect(() => {
        if (!isDesktop) return;
        const api = getElectronAPI()!;
        api.getAutostart().then(setAutostart);
        api.getMinimizeToTray().then(setMinimizeToTray);
        api.getAppVersion().then(setAppVersion);
    }, []);

    function toggle(key: string, value: boolean, setter: (v: boolean) => void) {
        localStorage.setItem(key, String(value));
        setter(value);
    }

    async function toggleAutostart(value: boolean) {
        const result = await getElectronAPI()!.setAutostart(value);
        setAutostart(result);
    }

    async function toggleMinimizeToTray(value: boolean) {
        const result = await getElectronAPI()!.setMinimizeToTray(value);
        setMinimizeToTray(result);
    }

    return (
        <div className="space-y-8">
            <div className="flex items-baseline justify-between">
                <h1 className="text-2xl font-bold text-white">App Settings</h1>
                {appVersion && (
                    <span className="text-sm font-medium text-[#949ba4]">
                        v{appVersion}
                    </span>
                )}
            </div>

            {/* Notifications */}
            <section>
                <h2 className="section-label mb-4">Notifications</h2>
                <div className="space-y-3">
                    <ToggleRow
                        label="Desktop Notifications"
                        description="Show desktop notifications for new messages when the app is in the background."
                        checked={desktopNotifs}
                        onChange={v => toggle(STORAGE.desktopNotifs, v, setDesktopNotifs)}
                    />
                    <ToggleRow
                        label="Notification Sounds"
                        description="Play a sound when you receive a new message."
                        checked={notifSounds}
                        onChange={v => toggle(STORAGE.notifSounds, v, setNotifSounds)}
                    />
                </div>
            </section>

            {/* Desktop-only settings */}
            {isDesktop && (
                <section>
                    <h2 className="section-label mb-4">Desktop</h2>
                    <div className="space-y-3">
                        <ToggleRow
                            label="Start on Boot"
                            description="Automatically start Librecord when you log in."
                            checked={autostart}
                            onChange={toggleAutostart}
                        />
                        <ToggleRow
                            label="Minimize to Tray"
                            description="Keep Librecord running in the system tray when you close the window."
                            checked={minimizeToTray}
                            onChange={toggleMinimizeToTray}
                        />
                    </div>
                </section>
            )}

            {/* Connection */}
            <section>
                <h2 className="section-label mb-4">Connection</h2>
                <div className="space-y-3">
                    <div className="bg-[#2b2d31] rounded-lg px-4 py-3">
                        <div className="text-sm font-medium text-white mb-0.5">Backend URL</div>
                        <div className="text-xs text-[#949ba4] mb-2">
                            Override the server this app connects to. Leave empty to use the default ({API_URL}).
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={apiUrl}
                                onChange={e => setApiUrl(e.target.value)}
                                placeholder={API_URL}
                                className="flex-1 bg-[#1e1f22] rounded px-3 py-1.5 text-sm text-[#dbdee1] border border-[#3f4147] focus:border-[#5865F2] outline-none placeholder-[#4e5058]"
                            />
                            <button
                                onClick={() => {
                                    const trimmed = apiUrl.trim();
                                    if (trimmed && trimmed !== savedApiUrl.current) {
                                        localStorage.setItem(STORAGE.apiUrl, trimmed);
                                        savedApiUrl.current = trimmed;
                                        window.location.reload();
                                    } else if (!trimmed && savedApiUrl.current) {
                                        localStorage.removeItem(STORAGE.apiUrl);
                                        savedApiUrl.current = "";
                                        window.location.reload();
                                    }
                                }}
                                disabled={apiUrl.trim() === savedApiUrl.current}
                                className="px-3 py-1.5 rounded text-sm font-medium text-white bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Developer */}
            <section>
                <h2 className="section-label mb-4">Developer</h2>
                <div className="space-y-3">
                    <ToggleRow
                        label="Developer Mode"
                        description="Show connection stats overlay on voice channels: ping, resolution, FPS, codec."
                        checked={devMode}
                        onChange={v => toggle(STORAGE.devMode, v, setDevMode)}
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
