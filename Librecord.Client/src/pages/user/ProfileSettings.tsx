import { useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useUserProfile } from "../../hooks/useUserProfile";
import { usePresence } from "../../hooks/usePresence";
import { StatusDot } from "../../components/user/StatusDot";
import { API_URL } from "../../api/client";

export default function ProfileSettings() {
    const { user, logout } = useAuth();
    const { updateDisplayName, uploadAvatar } = useUserProfile();
    const { myStatus, setMyStatus } = usePresence();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState(user?.displayName ?? "");
    const [isSavingName, setIsSavingName] = useState(false);

    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    if (!user) return null;

    const avatarSrc =
        avatarPreview ||
        (user.avatarUrl ? `${API_URL}${user.avatarUrl}` : "/default-avatar.png");

    function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setAvatarFile(file);
        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(URL.createObjectURL(file));
    }

    async function handleAvatarUpload() {
        if (!avatarFile) return;

        setUploadingAvatar(true);
        await uploadAvatar(avatarFile);
        setUploadingAvatar(false);

        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
        setAvatarFile(null);
    }

    async function saveDisplayName() {
        if (!name.trim()) return;

        setIsSavingName(true);
        await updateDisplayName(name.trim());
        setIsSavingName(false);
    }

    return (
        <div className="space-y-12 max-w-3xl">

            <h1 className="text-2xl font-bold text-white">
                My Account
            </h1>

            {/* --------------------------------
                PROFILE PICTURE
            -------------------------------- */}
            <section className="bg-[#2b2d31] rounded-lg p-6 border border-black/20">
                <h2 className="text-lg font-semibold text-white mb-4">
                    Profile Picture
                </h2>

                <div className="flex items-center gap-6">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="relative w-24 h-24 rounded-full cursor-pointer group"
                    >
                        <img
                            src={avatarSrc}
                            alt="Avatar"
                            className="w-full h-full rounded-full object-cover border border-black/40"
                        />

                        <div
                            className="
                                absolute inset-0 rounded-full
                                bg-black/60 opacity-0
                                group-hover:opacity-100
                                flex items-center justify-center
                                text-xs font-semibold
                                transition
                            "
                        >
                            Change Avatar
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarSelect}
                        className="hidden"
                    />

                    {avatarFile && (
                        <button
                            onClick={handleAvatarUpload}
                            disabled={uploadingAvatar}
                            className="
                                px-4 py-2 rounded
                                bg-[#5865F2] hover:bg-[#4752c4]
                                text-white text-sm font-medium
                                disabled:opacity-50
                            "
                        >
                            {uploadingAvatar ? "Uploading…" : "Save Avatar"}
                        </button>
                    )}
                </div>
            </section>

            {/* --------------------------------
                ACCOUNT INFO
            -------------------------------- */}
            <section className="bg-[#2b2d31] rounded-lg p-6 border border-black/20 space-y-5">
                <h2 className="text-lg font-semibold text-white">
                    Account Info
                </h2>

                <div>
                    <label className="text-xs uppercase text-gray-400">
                        Username
                    </label>
                    <div className="mt-1 px-3 py-2 rounded bg-[#1e1f22] text-gray-300">
                        {user.username}
                    </div>
                </div>

                <div>
                    <label className="text-xs uppercase text-gray-400">
                        Email
                    </label>
                    <div className="mt-1 px-3 py-2 rounded bg-[#1e1f22] text-gray-300">
                        {user.email}
                    </div>
                </div>

                <div>
                    <label className="text-xs uppercase text-gray-400">
                        Display Name
                    </label>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        maxLength={32}
                        className="
                            mt-1 w-full px-3 py-2 rounded
                            bg-[#1e1f22] text-white
                            outline-none
                            focus:ring-2 focus:ring-[#5865F2]
                        "
                    />

                    <button
                        onClick={saveDisplayName}
                        disabled={isSavingName}
                        className="
                            mt-3 px-4 py-2 rounded
                            bg-[#5865F2] hover:bg-[#4752c4]
                            text-white text-sm font-medium
                            disabled:opacity-50
                        "
                    >
                        {isSavingName ? "Saving…" : "Save Changes"}
                    </button>
                </div>
            </section>

            {/* --------------------------------
                ONLINE STATUS
            -------------------------------- */}
            <section className="bg-[#2b2d31] rounded-lg p-6 border border-black/20">
                <h2 className="text-lg font-semibold text-white mb-4">
                    Online Status
                </h2>
                <div className="grid grid-cols-2 gap-2">
                    {([
                        { value: "online", label: "Online" },
                        { value: "idle", label: "Idle" },
                        { value: "donotdisturb", label: "Do Not Disturb" },
                        { value: "offline", label: "Invisible" },
                    ] as const).map(s => (
                        <button
                            key={s.value}
                            onClick={() => setMyStatus(s.value)}
                            className={`
                                flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                                ${myStatus === s.value
                                    ? "bg-[#5865F2]/20 border border-[#5865F2] text-white"
                                    : "bg-[#1e1f22] border border-transparent text-[#b5bac1] hover:bg-[#35373c] hover:text-white"
                                }
                            `}
                        >
                            <StatusDot status={s.value} size="md" />
                            {s.label}
                        </button>
                    ))}
                </div>
            </section>

            {/* --------------------------------
                DANGER ZONE
            -------------------------------- */}
            <section className="border-t border-red-500/30 pt-6">
                <button
                    onClick={logout}
                    className="
                        px-5 py-3 rounded
                        bg-red-600 hover:bg-red-700
                        text-white font-semibold
                    "
                >
                    Logout
                </button>
            </section>
        </div>
    );
}
