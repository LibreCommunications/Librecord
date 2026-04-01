import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useUserProfile } from "../../hooks/useUserProfile";
import { usePresence } from "../../hooks/usePresence";
import { useToast } from "../../hooks/useToast";
import { StatusDot } from "../../components/user/StatusDot";
import { API_URL, userProfiles } from "../../api/client";
import { logger } from "../../lib/logger";

export default function ProfileSettings() {
    const { user, logout } = useAuth();
    const { updateDisplayName, uploadAvatar } = useUserProfile();
    const { myStatus, setMyStatus } = usePresence();
    const { toast } = useToast();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState(user?.displayName ?? "");
    const [bio, setBio] = useState("");
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [friendsVisible, setFriendsVisible] = useState(true);
    const [saving, setSaving] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [original, setOriginal] = useState({ name: user?.displayName ?? "", bio: "" });

    // Load existing profile data on mount
    const loaded = useRef(false);
    useEffect(() => {
        if (!user || loaded.current) return;
        loaded.current = true;
        userProfiles.get(user.userId).then(p => {
            setBio(p.bio ?? "");
            setBannerUrl(p.bannerUrl ?? null);
            setFriendsVisible(p.friendsVisibleSetting ?? true);
            setOriginal({ name: user.displayName, bio: p.bio ?? "" });
        }).catch(e => logger.api.warn("Failed to load user profile", e));
    }, [user]);

    if (!user) return null;

    const avatarSrc = avatarPreview || (user.avatarUrl ? `${API_URL}${user.avatarUrl}` : "/default-avatar.png");

    async function handleSaveAll() {
        setSaving(true);
        const promises: Promise<unknown>[] = [];
        if (name.trim() !== user?.displayName) promises.push(updateDisplayName(name.trim()));
        promises.push(userProfiles.updateBio(bio.trim() || null));
        if (avatarFile) promises.push(uploadAvatar(avatarFile));
        await Promise.all(promises);
        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
        setAvatarFile(null);
        setSaving(false);
        toast("Profile saved!", "success");
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-white">Profile & Account</h1>

            {/* ── Live Profile Preview ──────────────────────── */}
            <div className="bg-[#111214] rounded-xl overflow-hidden border border-[#2b2d31]">
                {/* Banner — decorative only */}
                <div
                    onClick={() => bannerInputRef.current?.click()}
                    className={`h-24 relative cursor-pointer group ${bannerUrl ? "" : "bg-[#5865F2]"}`}
                >
                    {bannerUrl && <img src={`${API_URL}${bannerUrl}`} className="w-full h-full object-cover" alt="" />}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/40 flex items-center justify-center text-white text-xs font-medium transition">
                        Change Banner
                    </div>
                </div>
                <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 5 * 1024 * 1024) { toast("Banner must be under 5 MB.", "error"); return; }
                        try {
                            const result = await userProfiles.uploadBanner(f);
                            setBannerUrl(result.bannerUrl);
                            toast("Banner updated!", "success");
                        } catch { toast("Failed to upload banner.", "error"); }
                        e.target.value = "";
                    }}
                />

                {/* Info section — solid bg, separate from banner */}
                <div className="bg-[#232428] px-4 pt-0 pb-4">
                    {/* Avatar straddles the banner/info boundary */}
                    <div className="flex items-end gap-3 -mt-8">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="relative w-[72px] h-[72px] rounded-full cursor-pointer group shrink-0"
                        >
                            <img src={avatarSrc} className="w-[72px] h-[72px] rounded-full object-cover border-4 border-[#232428]" alt="" />
                            <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-semibold text-white transition">
                                Change
                            </div>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setAvatarFile(file);
                            if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                            setAvatarPreview(URL.createObjectURL(file));
                        }} />
                        <div className="pb-1 min-w-0">
                            <p className="text-base font-bold text-white truncate">{name || user.displayName}</p>
                            <p className="text-xs text-[#949ba4]">@{user.username}</p>
                        </div>
                    </div>

                    {/* Bio preview */}
                    {bio && (
                        <div className="mt-3 bg-[#1e1f22] rounded-lg px-3 py-2">
                            <p className="text-[10px] font-semibold text-[#b5bac1] uppercase mb-1">About Me</p>
                            <p className="text-sm text-[#dbdee1] whitespace-pre-wrap">{bio}</p>
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={() => window.dispatchEvent(new CustomEvent("user:profile:open", { detail: { userId: user.userId } }))}
                className="text-sm text-[#5865F2] hover:underline"
            >
                Preview full profile
            </button>

            {/* ═══════ CARD 1: Profile ═══════ */}
            <section className="bg-[#2b2d31] rounded-xl p-5 border border-[#1e1f22] space-y-4">
                <h2 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wide">Profile</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1">Display Name</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            maxLength={32}
                            data-testid="profile-display-name"
                            className="w-full px-3 py-2 rounded bg-[#1e1f22] text-white outline-none border border-[#3f4147] focus:border-[#5865F2]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1">Online Status</label>
                        <div className="flex gap-1.5 h-[38px]">
                            {([
                                { value: "online", label: "Online" },
                                { value: "idle", label: "Idle" },
                                { value: "donotdisturb", label: "DND" },
                                { value: "offline", label: "Invisible" },
                            ] as const).map(s => (
                                <button
                                    key={s.value}
                                    onClick={() => setMyStatus(s.value)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 rounded text-xs font-medium transition-colors ${
                                        myStatus === s.value
                                            ? "bg-[#5865F2]/20 border border-[#5865F2] text-white"
                                            : "bg-[#1e1f22] border border-[#3f4147] text-[#b5bac1] hover:text-white"
                                    }`}
                                >
                                    <StatusDot status={s.value} size="sm" />
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1">About Me</label>
                    <textarea
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder="Tell people about yourself..."
                        data-testid="profile-bio"
                        className="w-full px-3 py-2 rounded bg-[#1e1f22] text-white outline-none border border-[#3f4147] focus:border-[#5865F2] resize-none"
                    />
                    <span className="text-xs text-[#949ba4]">{bio.length}/500</span>
                </div>

                {/* Unsaved changes bar */}
                {(name !== original.name || bio !== original.bio || avatarFile) && (
                    <div className="flex items-center justify-between bg-[#111214] rounded-lg px-4 py-2.5">
                        <span className="text-sm text-[#dbdee1]">Unsaved changes</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setName(original.name);
                                    setBio(original.bio);
                                    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                                    setAvatarPreview(null);
                                    setAvatarFile(null);
                                }}
                                data-testid="profile-revert-btn"
                                className="px-3 py-1.5 rounded text-sm text-white hover:underline"
                            >
                                Revert
                            </button>
                            <button
                                onClick={async () => {
                                    await handleSaveAll();
                                    setOriginal({ name: name.trim(), bio: bio.trim() });
                                }}
                                disabled={saving}
                                data-testid="profile-save-btn"
                                className="px-4 py-1.5 rounded bg-[#248046] hover:bg-[#1a6334] text-white text-sm font-medium disabled:opacity-50 transition-colors"
                            >
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* ═══════ CARD 2: Account & Privacy ═══════ */}
            <section className="bg-[#2b2d31] rounded-xl p-5 border border-[#1e1f22] space-y-4">
                <h2 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wide">Account</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1">Username</label>
                        <div className="px-3 py-2 rounded bg-[#1e1f22] text-[#949ba4] text-sm">{user.username}</div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1">Email</label>
                        <div className="px-3 py-2 rounded bg-[#1e1f22] text-[#949ba4] text-sm">{user.email}</div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div>
                        <div className="text-sm font-medium text-white">Show Friends on Profile</div>
                        <div className="text-xs text-[#949ba4] mt-0.5">Allow others to see your friend list.</div>
                    </div>
                    <button
                        onClick={async () => {
                            const next = !friendsVisible;
                            setFriendsVisible(next);
                            await userProfiles.updateFriendsVisible(next);
                        }}
                        aria-label="Toggle friends visibility"
                        data-testid="toggle-friends-visible"
                        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${friendsVisible ? "bg-[#248046]" : "bg-[#72767d]"}`}
                    >
                        <span className={`block w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-200 absolute top-[3px] ${friendsVisible ? "left-[23px]" : "left-[3px]"}`} />
                    </button>
                </div>

                <div className="pt-2 border-t border-[#3f4147]">
                    <button
                        onClick={logout}
                        data-testid="logout-btn"
                        className="px-5 py-2 rounded bg-[#da373c] hover:bg-[#a12828] text-white text-sm font-medium transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </section>
        </div>
    );
}
