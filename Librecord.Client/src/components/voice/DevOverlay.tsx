import { useEffect, useState } from "react";
import { getRoom } from "../../voice/livekitClient";
import { API_URL } from "../../api/client";

interface TrackStats {
    label: string;
    resolution?: string;
    fps?: number;
}

interface Stats {
    ping: number;
    tracks: TrackStats[];
}

async function measurePing(): Promise<number> {
    try {
        const start = performance.now();
        await fetch(`${API_URL}/health`, { method: "GET", cache: "no-store" });
        return Math.round(performance.now() - start);
    } catch {
        return 0;
    }
}

export function DevOverlay() {
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        const interval = setInterval(async () => {
            if (localStorage.getItem("lr:dev-mode") !== "true") { setStats(null); return; }

            const room = getRoom();
            if (!room) { setStats(null); return; }

            const ping = await measurePing();
            const tracks: TrackStats[] = [];

            // Local tracks
            for (const pub of room.localParticipant.trackPublications.values()) {
                const msTrack = pub.track?.mediaStreamTrack;
                if (!msTrack) continue;

                const settings = msTrack.getSettings();
                const source = pub.source ?? msTrack.kind;
                const entry: TrackStats = { label: `↑ ${source}` };

                if (msTrack.kind === "video" && settings.width && settings.height) {
                    entry.resolution = `${settings.width}x${settings.height}`;
                    entry.fps = settings.frameRate ? Math.round(settings.frameRate) : undefined;
                }
                tracks.push(entry);
            }

            // Remote tracks
            for (const participant of room.remoteParticipants.values()) {
                const name = participant.identity.slice(0, 8);
                for (const pub of participant.trackPublications.values()) {
                    const msTrack = pub.track?.mediaStreamTrack;
                    if (!msTrack) continue;

                    const settings = msTrack.getSettings();
                    const source = pub.source ?? msTrack.kind;
                    const entry: TrackStats = { label: `↓ ${name} ${source}` };

                    if (msTrack.kind === "video" && settings.width && settings.height) {
                        entry.resolution = `${settings.width}x${settings.height}`;
                        entry.fps = settings.frameRate ? Math.round(settings.frameRate) : undefined;
                    }
                    tracks.push(entry);
                }
            }

            setStats({ ping, tracks });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    if (!stats) return null;

    const pingColor = stats.ping === 0 ? "text-[#949ba4]" : stats.ping < 80 ? "text-green-400" : stats.ping < 200 ? "text-yellow-400" : "text-red-400";

    return (
        <div className="fixed bottom-4 right-4 z-[100] bg-black/80 rounded-lg px-3 py-2 text-xs font-mono text-white pointer-events-none select-none space-y-0.5 min-w-[400px]">
            <div className="flex items-center gap-2 border-b border-white/10 pb-1 mb-1">
                <span className="text-[#949ba4]">PING</span>
                <span className={`font-bold ${pingColor}`}>{stats.ping === 0 ? "N/A" : `${stats.ping}ms`}</span>
            </div>
            {stats.tracks.length === 0 && (
                <div className="text-[#949ba4]">No active tracks</div>
            )}
            {stats.tracks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="text-[#949ba4] truncate max-w-[120px]">{t.label}</span>
                    {t.resolution && <span className="text-white">{t.resolution}</span>}
                    {t.fps != null && <span className="text-green-300">{t.fps}fps</span>}
                </div>
            ))}
        </div>
    );
}
