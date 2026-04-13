import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@librecord/app";

export default function UserSettingsPage() {
    const { user } = useAuth();
    const needs2FA = !user?.twoFactorEnabled;

    return (
        <div className="flex w-full min-h-full bg-[#2f3136] text-gray-200">

        {/* LEFT SETTINGS SIDEBAR */}
            <aside className="w-60 shrink-0 bg-[#2b2d31] border-r border-black/20 flex flex-col overflow-y-auto p-6">

                <h2 className="text-gray-400 uppercase text-xs font-bold tracking-wide mb-3">
                    User Settings
                </h2>

                <nav className="flex flex-col space-y-1">
                    <NavLink to="profile" className={({ isActive }) =>
                        `px-3 py-2 rounded transition ${
                            isActive ? "bg-[#404249] text-white" : "hover:bg-[#3a3c43]"
                        }`
                    }>
                        Profile & Account
                    </NavLink>

                    <NavLink to="security" className={({ isActive }) =>
                        `px-3 py-2 rounded transition flex items-center justify-between ${
                            isActive ? "bg-[#404249] text-white" : "hover:bg-[#3a3c43]"
                        }`
                    }>
                        Security
                        {needs2FA && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#faa61a" className="shrink-0">
                                <path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z"/>
                            </svg>
                        )}
                    </NavLink>

                    <NavLink to="app" className={({ isActive }) =>
                        `px-3 py-2 rounded transition ${
                            isActive ? "bg-[#404249] text-white" : "hover:bg-[#3a3c43]"
                        }`
                    }>
                        App Settings
                    </NavLink>

                    <NavLink to="voice" className={({ isActive }) =>
                        `px-3 py-2 rounded transition ${
                            isActive ? "bg-[#404249] text-white" : "hover:bg-[#3a3c43]"
                        }`
                    }>
                        Voice & Video
                    </NavLink>
                </nav>
            </aside>

            {/* RIGHT CONTENT */}
            <main className="flex-1 overflow-y-auto p-10">
                <div className="flex justify-end mb-2">
                    <NavLink
                        to="changelog"
                        className={({ isActive }) =>
                            `text-xs font-medium px-3 py-1.5 rounded transition ${
                                isActive
                                    ? "bg-[#5865F2] text-white"
                                    : "text-[#949ba4] hover:text-white hover:bg-[#3a3c43]"
                            }`
                        }
                    >
                        What's New
                    </NavLink>
                </div>
                <Outlet />
            </main>
        </div>
    );
}
