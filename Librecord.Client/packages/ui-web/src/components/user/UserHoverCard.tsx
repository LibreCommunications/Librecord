import { useEffect, useRef, useState } from "react";
import { userProfiles, API_URL } from "@librecord/api-client";
import type { UserProfile } from "@librecord/domain";
import { logger } from "@librecord/domain";

interface Props {
    userId: string;
    children: React.ReactNode;
}

export function UserHoverCard({ userId, children }: Props) {
    const [show, setShow] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);

    function handleEnter() {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setShow(true);
            if (!profile) {
                userProfiles.get(userId).then(setProfile).catch(e => logger.api.warn("Failed to fetch user profile for hover card", e));
            }
        }, 400);
    }

    function handleLeave() {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setShow(false), 200);
    }

    useEffect(() => () => clearTimeout(timeoutRef.current), []);

    const avatarSrc = profile?.avatarUrl ? `${API_URL}${profile.avatarUrl}` : "/default-avatar.png";

    return (
        <div
            ref={containerRef}
            className="relative inline"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            {children}

            {show && profile && (
                <div
                    className="absolute z-[200] left-0 top-full mt-1 w-[280px] bg-[#232428] rounded-xl shadow-2xl border border-[#1e1f22] overflow-hidden"
                    onMouseEnter={() => clearTimeout(timeoutRef.current)}
                    onMouseLeave={handleLeave}
                >
                    {/* Mini banner */}
                    <div className={`h-[60px] ${profile.bannerUrl ? "" : "bg-[#5865F2]"}`}>
                        {profile.bannerUrl && (
                            <img src={`${API_URL}${profile.bannerUrl}`} className="w-full h-full object-cover" alt="" />
                        )}
                    </div>

                    <div className="px-3 -mt-6">
                        <img src={avatarSrc} className="w-12 h-12 rounded-full object-cover border-[3px] border-[#232428]" alt="" />
                    </div>

                    <div className="px-3 pt-1 pb-3">
                        <p className="text-sm font-bold text-white">{profile.displayName}</p>
                        <p className="text-xs text-[#949ba4]">@{profile.username}</p>

                        {profile.bio && (
                            <p className="text-xs text-[#b5bac1] mt-2 line-clamp-2">{profile.bio}</p>
                        )}

                        {!profile.isSelf && (
                            <div className="flex gap-1.5 mt-2">
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent("user:profile:open", { detail: { userId } }))}
                                    className="flex-1 py-1 rounded text-xs font-medium bg-[#5865F2] text-white hover:bg-[#4752c4] transition-colors"
                                >
                                    View Profile
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
