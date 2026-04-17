import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@librecord/app";
import LoadingSpinner from "@librecord/ui-web/src/components/LoadingSpinner.tsx";
import { UpdateModal } from "@librecord/ui-web/src/components/UpdateModal.tsx";
import { AuthRevocationHandler } from "@librecord/ui-web/src/components/AuthRevocationHandler.tsx";
import { DeepLinkHandler } from "./DeepLinkHandler.tsx";

const LoginPage = lazy(() => import("@librecord/ui-web/src/pages/auth/LoginPage.tsx"));
const RegisterPage = lazy(() => import("@librecord/ui-web/src/pages/auth/RegisterPage.tsx"));
const MainPage = lazy(() => import("@librecord/ui-web/src/pages/MainPage.tsx"));
const FriendsPage = lazy(() => import("@librecord/ui-web/src/pages/friends/FriendsPage.tsx"));
const DmConversationPage = lazy(() => import("@librecord/ui-web/src/pages/dm/DmConversationPage.tsx"));
const GuildPage = lazy(() => import("@librecord/ui-web/src/pages/guild/GuildPage.tsx"));
const GuildSettingsPage = lazy(() => import("@librecord/ui-web/src/pages/guild/GuildSettingsPage.tsx"));
const ChannelPermissionsPage = lazy(() => import("@librecord/ui-web/src/pages/guild/ChannelPermissionsPage.tsx"));
const UserSettingsPage = lazy(() => import("@librecord/ui-web/src/pages/user/UserSettingsPage.tsx"));
const ProfileSettings = lazy(() => import("@librecord/ui-web/src/pages/user/ProfileSettings.tsx"));
const AppSettings = lazy(() => import("@librecord/ui-web/src/pages/user/AppSettings.tsx"));
const VoiceVideoSettings = lazy(() => import("@librecord/ui-web/src/pages/user/VoiceVideoSettings.tsx"));
const SecuritySettings = lazy(() => import("@librecord/ui-web/src/pages/user/SecuritySettings.tsx"));
const ChangelogPage = lazy(() => import("@librecord/ui-web/src/pages/user/ChangelogPage.tsx"));

function ProtectedRoute() {
    const { isAuthenticated, authLoading } = useAuth();

    if (authLoading) return <LoadingSpinner />;

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <DeepLinkHandler />
            <UpdateModal />
            <AuthRevocationHandler />
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                <Route element={<ProtectedRoute />}>
                    <Route path="/app" element={<MainPage />}>
                        <Route path="dm" element={<DmConversationPage />} />
                        <Route path="dm/:dmId" element={<DmConversationPage />} />
                        <Route path="dm/friends/*" element={<FriendsPage />} />

                        <Route path="guild/:guildId" element={<GuildPage />} />
                        <Route path="guild/:guildId/:channelId" element={<GuildPage />} />

                        <Route path="guild/:guildId/settings" element={<GuildSettingsPage />} />
                        <Route path="guild/:guildId/:channelId/permissions" element={<ChannelPermissionsPage />} />

                        <Route path="settings">
                            <Route path="user" element={<UserSettingsPage />}>
                                <Route index element={<Navigate to="profile" replace />} />
                                <Route path="profile" element={<ProfileSettings />} />
                                <Route path="security" element={<SecuritySettings />} />
                                <Route path="app" element={<AppSettings />} />
                                <Route path="voice" element={<VoiceVideoSettings />} />
                                <Route path="changelog" element={<ChangelogPage />} />
                            </Route>
                        </Route>
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/app/dm" replace />} />
            </Routes>
        </Suspense>
    );
}
