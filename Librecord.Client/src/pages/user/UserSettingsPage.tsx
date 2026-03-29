import { NavLink, Outlet } from "react-router-dom";

export default function UserSettingsPage() {

    return (
        <div className="flex w-full min-h-full bg-[#2f3136] text-gray-200">

        {/* LEFT SETTINGS SIDEBAR */}
            <aside className="w-72 bg-[#2b2d31] border-r border-black/20 flex flex-col overflow-y-auto p-6">
                
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
                <Outlet />
            </main>
        </div>
    );
}
