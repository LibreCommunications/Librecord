import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import GlobalSidebar from "../components/layout/GlobalSidebar";
import ChannelSidebar from "../components/layout/ChannelSidebar";
import DmSidebar from "../components/layout/DmSidebar";
import { VoiceControls } from "../components/voice/VoiceControls";
import { DevOverlay } from "../components/voice/DevOverlay";
import { FloatingScreenShare } from "../components/voice/FloatingScreenShare";
import { UserProfilePopup } from "../components/user/UserProfilePopup";
import { ConnectionBanner } from "../components/ui/ConnectionBanner";
import { ErrorBoundary } from "../components/ui/ErrorBoundary";

import { RealtimeRoot } from "../realtime/RealtimeRoot";

export default function MainPage() {
    const location = useLocation();
    const [profileUserId, setProfileUserId] = useState<string | null>(null);

    const isDm = location.pathname.startsWith("/app/dm");
    const isGuild = location.pathname.startsWith("/app/guild/");
    const guildId = isGuild ? location.pathname.split("/")[3] : null;

    // Global event for opening profile popups from anywhere
    useEffect(() => {
        const handler = (e: CustomEvent<{ userId: string }>) => {
            setProfileUserId(e.detail.userId);
        };
        window.addEventListener("user:profile:open", handler as EventListener);
        return () => window.removeEventListener("user:profile:open", handler as EventListener);
    }, []);

    return (
        <div className="flex h-screen bg-[#2f3136] text-gray-200 overflow-hidden">

            <RealtimeRoot />
            <ConnectionBanner />
            <DevOverlay />
            <FloatingScreenShare />

            <GlobalSidebar />

            {isDm && (
                <div className="flex flex-col h-full bg-[#2a2c31]">
                    <div className="flex-1 min-h-0 overflow-auto">
                        <DmSidebar />
                    </div>
                    <VoiceControls />
                </div>
            )}

            {isGuild && guildId && (
                <div className="flex flex-col h-full bg-[#2a2c31]">
                    <div className="flex-1 min-h-0 overflow-auto">
                        <ChannelSidebar guildId={guildId} />
                    </div>
                    <VoiceControls />
                </div>
            )}

            <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
                <ErrorBoundary key={location.pathname}>
                    <Outlet />
                </ErrorBoundary>
            </div>

            {profileUserId && (
                <UserProfilePopup
                    userId={profileUserId}
                    onClose={() => setProfileUserId(null)}
                />
            )}
        </div>
    );
}
