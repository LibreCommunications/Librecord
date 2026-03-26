import { Outlet, useLocation } from "react-router-dom";
import GlobalSidebar from "../components/layout/GlobalSidebar";
import ChannelSidebar from "../components/layout/ChannelSidebar";
import DmSidebar from "../components/layout/DmSidebar";
import { VoiceControls } from "../components/voice/VoiceControls";
import { ConnectionBanner } from "../components/ui/ConnectionBanner";

import { RealtimeRoot } from "../realtime/RealtimeRoot";

export default function MainPage() {
    const location = useLocation();

    const isDm = location.pathname.startsWith("/app/dm");
    const isGuild = location.pathname.startsWith("/app/guild/");
    const guildId = isGuild ? location.pathname.split("/")[3] : null;

    return (
        <div className="flex h-screen bg-[#2f3136] text-gray-200 overflow-hidden">

            <RealtimeRoot />
            <ConnectionBanner />

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
                <Outlet />
            </div>
        </div>
    );
}
