import { useEffect, useRef, useState, useCallback } from "react";
import { Track } from "livekit-client";
import { getRoom } from "../../voice/livekitClient";
import { getVoiceState } from "../../voice/voiceStore";
import { useLocation, useNavigate } from "react-router-dom";

export function FloatingScreenShare() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [sharerName, setSharerName] = useState("");
    const location = useLocation();
    const navigate = useNavigate();

    // Draggable position + resizable width
    const [pos, setPos] = useState({ x: window.innerWidth - 336, y: window.innerHeight - 280 });
    const [size, setSize] = useState(320);
    const dragging = useRef(false);
    const resizing = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ x: 0, width: 0 });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        // Don't start drag if clicking on the video itself (that navigates)
        if ((e.target as HTMLElement).tagName === "VIDEO") return;
        e.preventDefault();
        dragging.current = true;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
    }, []);

    const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        resizing.current = true;
        resizeStart.current = { x: e.clientX, width: size };
    }, [size]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (dragging.current) {
                const x = Math.max(0, Math.min(window.innerWidth - size, e.clientX - dragOffset.current.x));
                const y = Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.current.y));
                setPos({ x, y });
            } else if (resizing.current) {
                const delta = e.clientX - resizeStart.current.x;
                setSize(Math.max(200, Math.min(800, resizeStart.current.width + delta)));
            }
        };
        const onUp = () => { dragging.current = false; resizing.current = false; };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [size]);

    useEffect(() => {
        const interval = setInterval(() => {
            const room = getRoom();
            const voice = getVoiceState();
            if (!room || !voice.isConnected) { setVisible(false); return; }

            const onVoicePage = voice.channelId && location.pathname.includes(voice.channelId);
            if (onVoicePage) { setVisible(false); return; }

            let screenTrack: Track | null = null;
            let name = "";
            for (const p of room.remoteParticipants.values()) {
                for (const pub of p.trackPublications.values()) {
                    if (pub.source === Track.Source.ScreenShare && pub.track) {
                        screenTrack = pub.track;
                        name = p.name || p.identity.slice(0, 12);
                        break;
                    }
                }
                if (screenTrack) break;
            }

            if (!screenTrack) { setVisible(false); return; }

            setSharerName(name);
            setVisible(true);

            const el = videoRef.current;
            if (el && screenTrack) {
                screenTrack.attach(el);
            }
        }, 1000);

        const el = videoRef.current;
        return () => {
            clearInterval(interval);
            if (el) el.srcObject = null;
        };
    }, [location.pathname]);

    if (!visible) return null;

    return (
        <div
            ref={containerRef}
            className="fixed z-[90] rounded-lg overflow-hidden shadow-2xl border border-[#1e1f22] bg-black group select-none"
            style={{ left: pos.x, top: pos.y, width: size }}
        >
            {/* Drag handle bar — only this starts drag */}
            <div
                className="h-6 bg-[#111214] flex items-center justify-center cursor-grab active:cursor-grabbing border-b border-white/5"
                onMouseDown={onMouseDown}
            >
                <div className="w-10 h-1 rounded-full bg-[#72767d]" />
            </div>

            {/* Video + click overlay to navigate */}
            <div className="relative cursor-pointer" onClick={() => {
                const v = getVoiceState();
                if (v.guildId && v.channelId) navigate(`/app/guild/${v.guildId}/${v.channelId}`);
            }}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full aspect-video object-contain bg-black"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors">
                    <span className="text-sm text-white font-medium opacity-0 hover:opacity-100 transition-opacity px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm">
                        Click to return
                    </span>
                </div>
            </div>

            <div className="bg-[#111214] px-3 py-1.5">
                <span className="text-xs text-[#b5bac1] font-medium truncate">{sharerName}&apos;s screen</span>
            </div>

            {/* Resize handle — bottom right corner */}
            <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
                onMouseDown={onResizeMouseDown}
            >
                <svg className="absolute bottom-0.5 right-0.5 text-[#4e5058] opacity-0 group-hover:opacity-100 transition-opacity" width="10" height="10" viewBox="0 0 10 10">
                    <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="9" y1="5" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            </div>
        </div>
    );
}
