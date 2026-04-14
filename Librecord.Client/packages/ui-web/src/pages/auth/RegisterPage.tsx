import { useState } from "react";
import { useAuth } from "@librecord/app";
import { useNavigate } from "react-router-dom";
import { Spinner } from "../../components/ui/Spinner";
import logoUrl from "../../assets/librecord.svg";

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
    const [copied, setCopied] = useState(false);

    async function handleRegister() {
        setError("");
        setLoading(true);

        const result = await register(email, username, displayName, password);

        setLoading(false);

        if (result.error) {
            setError(result.error);
            return;
        }

        if (result.accountRecoveryCodes?.length) {
            setRecoveryCodes(result.accountRecoveryCodes);
            return;
        }

        navigate("/app");
    }

    function handleDownload() {
        if (!recoveryCodes) return;
        const text = `Librecord Account Recovery Codes\n${"=".repeat(35)}\n\nKeep these codes somewhere safe. Each code can only be used once.\nIf you lose your password and your recovery codes, your account CANNOT be recovered.\n\n${recoveryCodes.join("\n")}\n`;
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `librecord-recovery-codes-${username}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ─── Recovery codes screen ──────────────────────────────────────
    if (recoveryCodes) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#5865F2] relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#3b44c4]/40 blur-[120px] animate-[drift_20s_ease-in-out_infinite]" />
                    <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-[#7983f5]/30 blur-[100px] animate-[drift_25s_ease-in-out_infinite_reverse]" />
                </div>
                <div className="w-[520px] bg-[#313338] p-8 rounded-2xl shadow-2xl relative z-10">
                    <div className="flex justify-center mb-4">
                        <img src={logoUrl} alt="Librecord" className="w-14 h-14" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2 text-center">
                        Save your recovery codes
                    </h1>

                    <div className="bg-[#2d2000] border border-[#faa61a]/30 rounded-lg px-4 py-3 mb-4">
                        <p className="text-sm text-[#faa61a] font-medium flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                                <path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z"/>
                            </svg>
                            This is the only time these codes will be shown
                        </p>
                        <p className="text-xs text-[#faa61a]/70 mt-1">
                            If you forget your password, a recovery code is the <strong>only way</strong> to get back into your account. Save them somewhere safe.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {recoveryCodes.map((code) => (
                            <code key={code} className="px-3 py-2 rounded bg-[#1e1f22] text-[#dbdee1] text-sm font-mono text-center">
                                {code}
                            </code>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex-1 py-2.5 rounded-[4px] font-semibold text-white bg-[#5865F2] hover:bg-[#4752c4] transition-colors text-sm"
                        >
                            Download .txt
                        </button>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(recoveryCodes.join("\n"));
                                setCopied(true);
                            }}
                            className="flex-1 py-2.5 rounded-[4px] font-semibold text-white bg-[#72767d] hover:bg-[#5d6169] transition-colors text-sm"
                        >
                            {copied ? "Copied!" : "Copy All"}
                        </button>
                    </div>

                    <button
                        onClick={() => navigate("/app")}
                        className="w-full mt-3 py-2.5 rounded-[4px] font-semibold text-white bg-[#248046] hover:bg-[#1a6334] transition-colors text-sm"
                    >
                        I've saved my codes — Continue
                    </button>
                </div>
            </div>
        );
    }

    // ─── Registration form ──────────────────────────────────────────
    return (
        <div className="h-screen w-full flex items-center justify-center bg-[#5865F2] relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#3b44c4]/40 blur-[120px] animate-[drift_20s_ease-in-out_infinite]" />
                <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-[#7983f5]/30 blur-[100px] animate-[drift_25s_ease-in-out_infinite_reverse]" />
            </div>
            <div className="w-[480px] bg-[#313338] p-8 rounded-2xl shadow-2xl animate-[scaleIn_0.2s_ease-out] relative z-10" data-testid="register-form">
                <div className="flex justify-center mb-6">
                    <img src={logoUrl} alt="Librecord" className="w-14 h-14" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1 text-center">
                    Create an account
                </h1>
                <p className="text-sm text-[#949ba4] mb-6 text-center">
                    Join Librecord and start chatting!
                </p>

                {error && (
                    <div className="mb-4 px-3 py-2 rounded bg-[#f23f43]/10 border border-[#f23f43]/30 text-[#f23f43] text-sm flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        {error}
                    </div>
                )}

                <label className="block mb-4">
                    <span className="section-label">
                        Email
                        <span className="text-[#f23f43] ml-0.5">*</span>
                    </span>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        data-testid="register-email"
                        className="input-field mt-2"
                    />
                </label>

                <label className="block mb-4">
                    <span className="section-label">
                        Username
                        <span className="text-[#f23f43] ml-0.5">*</span>
                    </span>
                    <input
                        type="text"
                        required
                        minLength={3}
                        maxLength={32}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        data-testid="register-username"
                        className="input-field mt-2"
                    />
                </label>

                <label className="block mb-4">
                    <span className="section-label">
                        Display Name
                    </span>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        data-testid="register-display-name"
                        className="input-field mt-2"
                    />
                </label>

                <label className="block mb-6">
                    <span className="section-label">
                        Password
                        <span className="text-[#f23f43] ml-0.5">*</span>
                    </span>
                    <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleRegister()}
                        data-testid="register-password"
                        className="input-field mt-2"
                    />
                </label>

                <button
                    onClick={handleRegister}
                    disabled={loading}
                    data-testid="register-submit"
                    className="w-full py-2.5 rounded-[4px] font-semibold text-white bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                    {loading && <Spinner size="sm" />}
                    {loading ? "Creating account..." : "Continue"}
                </button>

                <p className="mt-3 text-sm text-[#949ba4]">
                    Already have an account?{" "}
                    <a href="/login" className="text-[#00a8fc] hover:underline">
                        Log In
                    </a>
                </p>
            </div>
        </div>
    );
}
