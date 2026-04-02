import { useState, useEffect } from "react";
import { useFriends, type FriendSuggestion } from "@librecord/app";
import { useToast } from "@librecord/app";
import { Spinner } from "../../components/ui/Spinner";
import { API_URL } from "@librecord/api-client";

export default function FriendsAddPage() {
    const { sendRequest, suggestUsernames } = useFriends();
    const { toast } = useToast();

    const [username, setUsername] = useState("");
    const [rawSuggestions, setRawSuggestions] = useState<FriendSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);

    const suggestions = username.trim() ? rawSuggestions : [];

    useEffect(() => {
        if (!username.trim()) return;

        const timeout = setTimeout(async () => {
            const results = await suggestUsernames(username.trim());
            setRawSuggestions(results);
            setShowSuggestions(true);
        }, 250);

        return () => clearTimeout(timeout);
    }, [username, suggestUsernames]);

    function handleSelect(name: string) {
        setUsername(name);
        setShowSuggestions(false);
    }

    async function handleAddFriend() {
        if (!username.trim()) return;

        setLoading(true);
        const ok = await sendRequest(username.trim());
        setLoading(false);

        if (ok) {
            toast("Friend request sent!", "success");
            setUsername("");
        } else {
            toast("Could not send friend request.", "error");
        }
        setShowSuggestions(false);
    }

    return (
        <div className="text-gray-200 relative">
            <h1 className="text-xl font-bold text-white">Add Friend</h1>
            <p className="text-[#b5bac1] text-sm mt-1 mb-4">
                You can add friends with their username.
            </p>

            <div className="flex gap-2 relative">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Enter a username"
                        className="w-full bg-[#1e1f22] text-white outline-none rounded-[4px] h-11 px-3 text-sm border border-[#1e1f22] focus:border-[#5865F2] transition-colors"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onFocus={() => username.trim() && setShowSuggestions(true)}
                        onKeyDown={e => e.key === "Enter" && handleAddFriend()}
                    />

                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[#111214] border border-[#2b2d31] rounded-lg shadow-xl z-50 overflow-hidden animate-[scaleIn_0.1s_ease-out]">
                            {suggestions.map((s) => (
                                <div
                                    key={s.id}
                                    onClick={() => handleSelect(s.username)}
                                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#5865F2] transition-colors"
                                >
                                    <img
                                        src={s.avatarUrl ? `${API_URL}${s.avatarUrl}` : "/default-avatar.png"}
                                        className="w-8 h-8 rounded-full object-cover"
                                        alt=""
                                    />
                                    <div>
                                        <div className="text-sm text-white font-medium">{s.displayName}</div>
                                        <div className="text-xs text-[#949ba4]">@{s.username}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    onClick={handleAddFriend}
                    disabled={loading || !username.trim()}
                    className="h-11 px-5 rounded-[4px] bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center gap-2"
                >
                    {loading && <Spinner size="sm" />}
                    Send Friend Request
                </button>
            </div>
        </div>
    );
}
