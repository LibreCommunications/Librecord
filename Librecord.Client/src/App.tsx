import {Routes, Route, Navigate, Outlet} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";

import MainPage from "./pages/MainPage";
import UserSettingsPage from "./pages/user/UserSettingsPage";

import FriendsPage from "./pages/friends/FriendsPage";

import LoadingSpinner from "./components/LoadingSpinner";

import DmConversationPage from "./pages/dm/DmConversationPage";
import GuildPage from "./pages/guild/GuildPage";
import GuildSettingsPage from "./pages/guild/GuildSettingsPage";
import ChannelPermissionsPage from "./pages/guild/ChannelPermissionsPage";

import ProfileSettings from "./pages/user/ProfileSettings";
import AppSettings from "./pages/user/AppSettings";


function ProtectedRoute() {
    const { isAuthenticated, authLoading } = useAuth();

    if (authLoading) return <LoadingSpinner />;

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <Routes>
            {/* PUBLIC */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
                <Route path="/app" element={<MainPage />}>
                    {/* DM */}
                    <Route path="dm" element={<DmConversationPage />} />
                    <Route path="dm/:dmId" element={<DmConversationPage />} />
                    <Route path="dm/friends/*" element={<FriendsPage />} />

                    {/* GUILD */}
                    <Route path="guild/:guildId" element={<GuildPage />} />
                    <Route path="guild/:guildId/:channelId" element={<GuildPage />} />

                    {/* GUILD SETTINGS */}
                    <Route path="guild/:guildId/settings" element={<GuildSettingsPage />} />
                    <Route path="guild/:guildId/:channelId/permissions" element={<ChannelPermissionsPage />} />

                    {/* SETTINGS */}
                    <Route path="settings">
                        {/* USER SETTINGS */}
                        <Route path="user" element={<UserSettingsPage />}>
                            <Route index element={<Navigate to="profile" replace />} />
                            <Route path="profile" element={<ProfileSettings />} />
                            <Route path="app" element={<AppSettings />} />
                        </Route>
                    </Route>
                </Route>
            </Route>


            {/* FALLBACK */}
            <Route path="*" element={<Navigate to="/app/dm" replace />} />
        </Routes>
    );
}

