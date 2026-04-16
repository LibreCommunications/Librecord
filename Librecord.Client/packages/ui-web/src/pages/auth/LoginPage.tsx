import { useRef, useState } from "react";
import { useAuth } from "@librecord/app";
import { useNavigate } from "react-router-dom";
import { auth as authApi } from "@librecord/api-client";
import { Spinner } from "../../components/ui/Spinner";
import logoUrl from "../../assets/librecord.svg";

export default function LoginPage() {
    const { login, loadUser } = useAuth();
    const navigate = useNavigate();

    const [emailOrUsername, setEmailOrUsername] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // 2FA state
    const [twoFactorSessionToken, setTwoFactorSessionToken] = useState<string | null>(null);
    const [totpDigits, setTotpDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const [useRecovery, setUseRecovery] = useState(false);
    const [recoveryCode, setRecoveryCode] = useState("");
    const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Account recovery state
    const [showRecovery, setShowRecovery] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState("");
    const [accountRecoveryCode, setAccountRecoveryCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [recoverySuccess, setRecoverySuccess] = useState(false);

    async function handleLogin() {
        setError("");
        setLoading(true);

        const result = await login(emailOrUsername, password);

        setLoading(false);

        if (result.requiresTwoFactor) {
            setTwoFactorSessionToken(result.twoFactorSessionToken!);
            return;
        }

        if (result.error) {
            setError(result.error);
            return;
        }

        navigate("/app");
    }

    const totpCode = totpDigits.join("");

    async function handleTwoFactor() {
        setError("");
        setLoading(true);

        const res = useRecovery
            ? await authApi.verifyTwoFactorRecovery(twoFactorSessionToken!, recoveryCode)
            : await authApi.verifyTwoFactor(twoFactorSessionToken!, totpCode);

        const data = await res.json();
        setLoading(false);

        if (!res.ok || !data.success) {
            setError(data.error ?? "Invalid code");
            return;
        }

        await loadUser();
        navigate("/app");
    }

    function handleDigitChange(index: number, value: string) {
        if (value.length > 1) {
            // Handle paste — distribute digits across boxes
            const digits = value.replace(/\D/g, "").slice(0, 6).split("");
            const next = [...totpDigits];
            digits.forEach((d, i) => {
                if (index + i < 6) next[index + i] = d;
            });
            setTotpDigits(next);
            const focusIdx = Math.min(index + digits.length, 5);
            digitRefs.current[focusIdx]?.focus();
            return;
        }

        const digit = value.replace(/\D/g, "");
        const next = [...totpDigits];
        next[index] = digit;
        setTotpDigits(next);

        if (digit && index < 5) {
            digitRefs.current[index + 1]?.focus();
        }
    }

    function handleDigitKeyDown(index: number, e: React.KeyboardEvent) {
        if (e.key === "Backspace" && !totpDigits[index] && index > 0) {
            const next = [...totpDigits];
            next[index - 1] = "";
            setTotpDigits(next);
            digitRefs.current[index - 1]?.focus();
        }
        if (e.key === "Enter" && totpCode.length === 6) {
            handleTwoFactor();
        }
    }

    async function handleAccountRecovery() {
        setError("");
        setLoading(true);

        const res = await authApi.recoverAccount(recoveryEmail, accountRecoveryCode, newPassword);
        const data = await res.json();
        setLoading(false);

        if (!res.ok || !data.success) {
            setError(data.error ?? "Recovery failed");
            return;
        }

        setRecoverySuccess(true);
    }

    // ─── Account recovery screen ────────────────────────────────────
    if (showRecovery) {
        if (recoverySuccess) {
            return (
                <div className="h-screen w-full flex items-center justify-center bg-[#5865F2] relative overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#3b44c4]/40 blur-[120px] animate-[drift_20s_ease-in-out_infinite]" />
                        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-[#7983f5]/30 blur-[100px] animate-[drift_25s_ease-in-out_infinite_reverse]" />
                    </div>
                    <div className="w-[480px] bg-[#313338] p-8 rounded-2xl shadow-2xl relative z-10 text-center">
                        <div className="flex justify-center mb-6">
                            <img src={logoUrl} alt="Librecord" className="w-14 h-14" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Password reset!</h1>
                        <p className="text-sm text-[#949ba4] mb-6">
                            Your password has been changed. You can now log in with your new password.
                        </p>
                        <button
                            onClick={() => { setShowRecovery(false); setRecoverySuccess(false); setError(""); setRecoveryEmail(""); setAccountRecoveryCode(""); setNewPassword(""); }}
                            className="inline-block px-6 py-2.5 rounded-[4px] font-semibold text-white bg-[#5865F2] hover:bg-[#4752c4] transition-colors"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#5865F2] relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#3b44c4]/40 blur-[120px] animate-[drift_20s_ease-in-out_infinite]" />
                    <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-[#7983f5]/30 blur-[100px] animate-[drift_25s_ease-in-out_infinite_reverse]" />
                </div>
                <div className="w-[480px] bg-[#313338] p-8 rounded-2xl shadow-2xl relative z-10">
                    <div className="flex justify-center mb-6">
                        <img src={logoUrl} alt="Librecord" className="w-14 h-14" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1 text-center">
                        Reset your password
                    </h1>
                    <p className="text-sm text-[#949ba4] mb-6 text-center">
                        Enter your account details and one of your recovery codes to set a new password.
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
                            Email or Username
                            <span className="text-[#f23f43] ml-0.5">*</span>
                        </span>
                        <input
                            type="text"
                            required
                            value={recoveryEmail}
                            onChange={(e) => setRecoveryEmail(e.target.value)}
                            className="input-field mt-2"
                        />
                    </label>

                    <label className="block mb-4">
                        <span className="section-label">
                            Recovery Code
                            <span className="text-[#f23f43] ml-0.5">*</span>
                        </span>
                        <input
                            type="text"
                            required
                            value={accountRecoveryCode}
                            onChange={(e) => setAccountRecoveryCode(e.target.value)}
                            placeholder="xxxx-xxxx-xxxx"
                            className="input-field mt-2 font-mono"
                        />
                    </label>

                    <label className="block mb-6">
                        <span className="section-label">
                            New Password
                            <span className="text-[#f23f43] ml-0.5">*</span>
                        </span>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAccountRecovery()}
                            className="input-field mt-2"
                        />
                    </label>

                    <button
                        onClick={handleAccountRecovery}
                        disabled={loading || !recoveryEmail || !accountRecoveryCode || !newPassword}
                        className="w-full py-2.5 rounded-[4px] font-semibold text-white bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {loading && <Spinner size="sm" />}
                        {loading ? "Resetting..." : "Reset Password"}
                    </button>

                    <p className="mt-3 text-sm">
                        <button
                            onClick={() => { setShowRecovery(false); setError(""); }}
                            className="text-[#00a8fc] hover:underline"
                        >
                            Back to login
                        </button>
                    </p>
                </div>
            </div>
        );
    }

    // ─── 2FA code entry screen ──────────────────────────────────────
    if (twoFactorSessionToken) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#5865F2] relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#3b44c4]/40 blur-[120px] animate-[drift_20s_ease-in-out_infinite]" />
                    <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-[#7983f5]/30 blur-[100px] animate-[drift_25s_ease-in-out_infinite_reverse]" />
                </div>
                <div className="w-[480px] bg-[#313338] p-8 rounded-2xl shadow-2xl relative z-10">
                    <div className="flex justify-center mb-6">
                        <img src={logoUrl} alt="Librecord" className="w-14 h-14" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1 text-center">
                        Two-Factor Authentication
                    </h1>
                    <p className="text-sm text-[#949ba4] mb-6 text-center">
                        {useRecovery
                            ? "Enter one of your recovery codes"
                            : "Enter the 6-digit code from your authenticator app"}
                    </p>

                    {error && (
                        <div className="mb-4 px-3 py-2 rounded bg-[#f23f43]/10 border border-[#f23f43]/30 text-[#f23f43] text-sm flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                            </svg>
                            {error}
                        </div>
                    )}

                    {useRecovery ? (
                        <label className="block mb-6">
                            <span className="section-label">
                                Recovery Code
                                <span className="text-[#f23f43] ml-0.5">*</span>
                            </span>
                            <input
                                type="text"
                                required
                                value={recoveryCode}
                                onChange={(e) => setRecoveryCode(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleTwoFactor()}
                                placeholder="xxxx-xxxx"
                                className="input-field mt-2"
                            />
                        </label>
                    ) : (
                        <div className="mb-6">
                            <span className="section-label">
                                Authentication Code
                                <span className="text-[#f23f43] ml-0.5">*</span>
                            </span>
                            <div className="flex justify-center gap-2 mt-3">
                                {totpDigits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => { digitRefs.current[i] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={digit}
                                        onChange={e => handleDigitChange(i, e.target.value)}
                                        onKeyDown={e => handleDigitKeyDown(i, e)}
                                        onFocus={e => e.target.select()}
                                        autoFocus={i === 0}
                                        className="w-11 h-13 rounded-lg bg-[#1e1f22] text-white text-center text-xl font-semibold border border-[#1e1f22] focus:border-[#5865F2] outline-none transition-colors"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleTwoFactor}
                        disabled={loading}
                        className="w-full py-2.5 rounded-[4px] font-semibold text-white bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {loading && <Spinner size="sm" />}
                        {loading ? "Verifying..." : "Verify"}
                    </button>

                    <div className="mt-4 flex justify-between text-sm">
                        <button
                            onClick={() => { setUseRecovery(!useRecovery); setError(""); }}
                            className="text-[#00a8fc] hover:underline"
                        >
                            {useRecovery ? "Use authenticator app" : "Use a recovery code"}
                        </button>
                        <button
                            onClick={() => { setTwoFactorSessionToken(null); setTotpDigits(["", "", "", "", "", ""]); setRecoveryCode(""); setError(""); }}
                            className="text-[#949ba4] hover:underline"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ���── Normal login form ──────────────────────────────────────────
    return (
        <div className="h-screen w-full flex items-center justify-center bg-[#5865F2] relative overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#3b44c4]/40 blur-[120px] animate-[drift_20s_ease-in-out_infinite]" />
                <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-[#7983f5]/30 blur-[100px] animate-[drift_25s_ease-in-out_infinite_reverse]" />
                <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-[#4752c4]/30 blur-[80px] animate-[drift_18s_ease-in-out_infinite_2s]" />
            </div>

            <div className="w-[480px] bg-[#313338] p-8 rounded-2xl shadow-2xl animate-[scaleIn_0.2s_ease-out] relative z-10" data-testid="login-form">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <img src={logoUrl} alt="Librecord" className="w-14 h-14" />
                </div>

                <h1 className="text-2xl font-bold text-white mb-1 text-center">
                    Welcome back!
                </h1>
                <p className="text-sm text-[#949ba4] mb-6 text-center">
                    We're so excited to see you again!
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
                        Email or Username
                        <span className="text-[#f23f43] ml-0.5">*</span>
                    </span>
                    <input
                        type="text"
                        required
                        value={emailOrUsername}
                        onChange={(e) => setEmailOrUsername(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleLogin()}
                        data-testid="login-username"
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
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleLogin()}
                        data-testid="login-password"
                        className="input-field mt-2"
                    />
                </label>

                <button
                    onClick={handleLogin}
                    disabled={loading}
                    data-testid="login-submit"
                    className="w-full py-2.5 rounded-[4px] font-semibold text-white bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                    {loading && <Spinner size="sm" />}
                    {loading ? "Logging in..." : "Log In"}
                </button>

                <div className="mt-3 flex justify-between text-sm text-[#949ba4]">
                    <span>
                        Need an account?{" "}
                        <a href="/register" className="text-[#00a8fc] hover:underline">
                            Register
                        </a>
                    </span>
                    <button
                        onClick={() => { setShowRecovery(true); setError(""); }}
                        className="text-[#00a8fc] hover:underline"
                    >
                        Forgot password?
                    </button>
                </div>
            </div>
        </div>
    );
}
