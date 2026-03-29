import { useState } from "react";
import * as livekitClient from "../../voice/livekitClient";
import { NoiseSuppression } from "../../components/voice/NoiseSuppression";
import { logger } from "../../lib/logger";

export default function VoiceVideoSettings() {
    const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
    const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
    const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
    const [prefs, setPrefs] = useState(livekitClient.getAllDevicePrefs);
    const [devicesLoaded, setDevicesLoaded] = useState(false);

    async function loadDevices() {
        if (devicesLoaded) return;
        setDevicesLoaded(true);
        try {
            // Only request audio — avoids briefly activating the camera.
            // Device labels for video inputs are typically available after any permission grant.
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
        } catch { /* user may deny */ }
        setAudioInputs(await livekitClient.listAudioInputDevices());
        setAudioOutputs(await livekitClient.listAudioOutputDevices());
        setVideoInputs(await livekitClient.listVideoDevices());
    }

    function selectDevice(kind: "audioinput" | "videoinput" | "audiooutput", deviceId: string) {
        livekitClient.setDevicePref(kind, deviceId);
        setPrefs(livekitClient.getAllDevicePrefs());
        // Apply immediately if in a voice channel
        const mediaKind: MediaDeviceKind =
            kind === "audioinput" ? "audioinput" :
            kind === "audiooutput" ? "audiooutput" : "videoinput";
        livekitClient.switchActiveDevice(mediaKind, deviceId).catch(e => logger.voice.warn("Failed to switch active device", e));
    }

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-white">Voice & Video</h1>

            {/* Devices */}
            <section ref={() => { loadDevices(); }}>
                <h2 className="section-label mb-4">Devices</h2>
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
            </section>

            {/* Noise Suppression */}
            <section>
                <h2 className="section-label mb-4">Noise Suppression</h2>
                <NoiseSuppression />
            </section>
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
