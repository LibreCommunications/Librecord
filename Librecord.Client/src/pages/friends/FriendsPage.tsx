import { Routes, Route, NavLink } from "react-router-dom";
import FriendsAddPage from "./FriendsAddPage";
import FriendsListPage from "./FriendsListPage";


export default function FriendsPage() {
    return (
        <div className="flex w-full h-full">

            {/* LEFT: FRIENDS MENU (SUB-SIDEBAR) */}
            <aside className="w-64 bg-[#202225] p-6 border-r border-black/20 flex flex-col">

                <h2 className="text-gray-400 uppercase text-xs font-bold mb-4">
                    Friends
                </h2>

                {/* Menu Items */}
                <nav className="flex flex-col space-y-1">

                    <NavLink
                        to="/app/dm/friends/list"
                        className={({ isActive }) =>
                            `
                            px-3 py-2 rounded text-left transition
                            ${isActive
                                ? "bg-[#404249] text-white"
                                : "hover:bg-[#2f3136] text-gray-300"}
                            `
                        }
                    >
                        All Friends
                    </NavLink>

                    <NavLink
                        to="/app/dm/friends/add"
                        className={({ isActive }) =>
                            `
                            px-3 py-2 rounded text-left transition
                            ${isActive
                                ? "bg-[#404249] text-white"
                                : "hover:bg-[#2f3136] text-gray-300"}
                            `
                        }
                    >
                        Add Friend
                    </NavLink>

                </nav>

                <div className="flex-1" />
            </aside>

            {/* RIGHT: CONTENT AREA */}
            <main className="flex-1 p-8 overflow-y-auto">
                <Routes>
                    <Route path="list" element={<FriendsListPage />} />
                    <Route path="add" element={<FriendsAddPage />} />

                    {/* Default */}
                    <Route path="*" element={<FriendsListPage />} />
                </Routes>
            </main>
        </div>
    );
}
