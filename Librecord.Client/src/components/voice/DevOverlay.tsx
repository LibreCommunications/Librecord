import { useEffect, useRef, useState } from "react";
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

export function DevOverlay({ embedded }: { embedded?: boolean } = {}) {
    const [stats, setStats] = useState<Stats | null>(null);
    const prevFrames = useRef(new Map<string, { frames: number; ts: number }>());

    useEffect(() => {
        const interval = setInterval(async () => {
            if (localStorage.getItem("lr:dev-mode") !== "true") { setStats(null); return; }

            const room = getRoom();
            if (!room) { setStats(null); return; }

            const ping = await measurePing();
            const tracks: TrackStats[] = [];

            // Local tracks — skip muted/disabled
            for (const pub of room.localParticipant.trackPublications.values()) {
                if (pub.isMuted || !pub.track?.mediaStreamTrack) continue;
                const msTrack = pub.track.mediaStreamTrack;

                const settings = msTrack.getSettings();
                const source = pub.source ?? msTrack.kind;
                const entry: TrackStats = { label: `↑ ${source}` };

                if (msTrack.kind === "video" && settings.width && settings.height) {
                    entry.resolution = `${settings.width}x${settings.height}`;
                    entry.fps = settings.frameRate ? Math.round(settings.frameRate) : undefined;
                }
                tracks.push(entry);
            }

            // Remote tracks — only show tracks with attached video elements
            for (const participant of room.remoteParticipants.values()) {
                const name = participant.name || participant.identity;
                for (const pub of participant.trackPublications.values()) {
                    if (!pub.isSubscribed || !pub.track) continue;
                    // Skip if track has no attached elements (not watching)
                    if (pub.track.attachedElements.length === 0) continue;
                    const msTrack = pub.track.mediaStreamTrack;
                    if (!msTrack) continue;

                    const source = pub.source ?? msTrack.kind;
                    const entry: TrackStats = { label: `↓ ${name} ${source}` };
                    const key = `${participant.identity}-${source}`;

                    if (msTrack.kind === "video") {
                        // Try to get resolution and FPS from receiver stats
                        const receiver = pub.track?.receiver;
                        if (receiver) {
                            try {
                                const report = await receiver.getStats();
                                for (const [, s] of report) {
                                    if (s.type === "inbound-rtp" && s.kind === "video") {
                                        if (s.frameWidth && s.frameHeight) {
                                            entry.resolution = `${s.frameWidth}x${s.frameHeight}`;
                                        }
                                        // Calculate FPS from framesReceived delta
                                        const now = performance.now();
                                        const prev = prevFrames.current.get(key);
                                        if (prev && s.framesReceived != null) {
                                            const dt = (now - prev.ts) / 1000;
                                            if (dt > 0) entry.fps = Math.round((s.framesReceived - prev.frames) / dt);
                                        }
                                        if (s.framesReceived != null) {
                                            prevFrames.current.set(key, { frames: s.framesReceived, ts: now });
                                        }
                                        break;
                                    }
                                }
                            } catch { /* stats not available */ }
                        }

                        // Fallback to getSettings if stats didn't provide resolution
                        if (!entry.resolution) {
                            const settings = msTrack.getSettings();
                            if (settings.width && settings.height) {
                                entry.resolution = `${settings.width}x${settings.height}`;
                            }
                        }
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
        <div className={`${embedded ? "absolute bottom-4 right-4 z-50" : "fixed bottom-4 right-4 z-[100]"} bg-black/80 rounded-lg px-3 py-2 text-xs font-mono text-white pointer-events-none select-none space-y-0.5 min-w-[400px]`}>
            <div className="flex items-center gap-2 border-b border-white/10 pb-1 mb-1">
                <span className="text-[#949ba4]">PING</span>
                <span className={`font-bold ${pingColor}`}>{stats.ping === 0 ? "N/A" : `${stats.ping}ms`}</span>
            </div>
            {stats.tracks.length === 0 && (
                <div className="text-[#949ba4]">No active tracks</div>
            )}
            {stats.tracks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="text-[#949ba4]">{t.label}</span>
                    {t.resolution && <span className="text-white">{t.resolution}</span>}
                    {t.fps != null && <span className="text-green-300">{t.fps}fps</span>}
                </div>
            ))}
        </div>
    );
}
