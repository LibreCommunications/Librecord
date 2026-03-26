import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import LoadingSpinner from "./components/LoadingSpinner";

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const MainPage = lazy(() => import("./pages/MainPage"));
const FriendsPage = lazy(() => import("./pages/friends/FriendsPage"));
const DmConversationPage = lazy(() => import("./pages/dm/DmConversationPage"));
const GuildPage = lazy(() => import("./pages/guild/GuildPage"));
const GuildSettingsPage = lazy(() => import("./pages/guild/GuildSettingsPage"));
const ChannelPermissionsPage = lazy(() => import("./pages/guild/ChannelPermissionsPage"));
const UserSettingsPage = lazy(() => import("./pages/user/UserSettingsPage"));
const ProfileSettings = lazy(() => import("./pages/user/ProfileSettings"));
const AppSettings = lazy(() => import("./pages/user/AppSettings"));

function ProtectedRoute() {
    const { isAuthenticated, authLoading } = useAuth();

    if (authLoading) return <LoadingSpinner />;

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
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
                                <Route path="app" element={<AppSettings />} />
                            </Route>
                        </Route>
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/app/dm" replace />} />
            </Routes>
        </Suspense>
    );
}
