import { useState } from "react";
import { useAuth, useToast } from "@librecord/app";
import { auth } from "@librecord/api-client";
import { QRCodeSVG } from "qrcode.react";
import { Spinner } from "../../components/ui/Spinner";

type Step = "idle" | "setup" | "confirm" | "recovery-codes" | "disable-confirm" | "regenerate-confirm";

export default function SecuritySettings() {
    const { user, loadUser } = useAuth();
    const { toast } = useToast();

    const [step, setStep] = useState<Step>("idle");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Setup state
    const [sharedKey, setSharedKey] = useState("");
    const [authenticatorUri, setAuthenticatorUri] = useState("");
    const [totpCode, setTotpCode] = useState("");

    // Recovery codes
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

    // Password for disable/regenerate
    const [password, setPassword] = useState("");

    const is2FAEnabled = user?.twoFactorEnabled ?? false;

    async function handleSetup() {
        setError("");
        setLoading(true);
        try {
            const result = await auth.setupTwoFactor();
            setSharedKey(result.sharedKey);
            setAuthenticatorUri(result.authenticatorUri);
            setStep("setup");
        } catch {
            setError("Failed to start 2FA setup");
        }
        setLoading(false);
    }

    async function handleEnable() {
        setError("");
        setLoading(true);
        try {
            const result = await auth.enableTwoFactor(totpCode);
            setRecoveryCodes(result.recoveryCodes);
            setStep("recovery-codes");
            await loadUser();
            toast("Two-factor authentication enabled!", "success");
        } catch {
            setError("Invalid code. Please try again.");
        }
        setLoading(false);
    }

    async function handleDisable() {
        setError("");
        setLoading(true);
        try {
            await auth.disableTwoFactor(password);
            setStep("idle");
            setPassword("");
            await loadUser();
            toast("Two-factor authentication disabled.", "success");
        } catch {
            setError("Invalid password.");
        }
        setLoading(false);
    }

    async function handleRegenerate() {
        setError("");
        setLoading(true);
        try {
            const result = await auth.regenerateRecoveryCodes(password);
            setRecoveryCodes(result.recoveryCodes);
            setStep("recovery-codes");
            setPassword("");
            toast("Recovery codes regenerated!", "success");
        } catch {
            setError("Invalid password.");
        }
        setLoading(false);
    }

    function resetState() {
        setStep("idle");
        setError("");
        setTotpCode("");
        setPassword("");
        setSharedKey("");
        setAuthenticatorUri("");
        setRecoveryCodes([]);
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-white">Security</h1>

            {/* ═���═════ 2FA Section ═══════ */}
            <section className="bg-[#2b2d31] rounded-xl p-5 border border-[#1e1f22] space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wide">
                            Two-Factor Authentication
                        </h2>
                        <p className="text-xs text-[#949ba4] mt-1">
                            Add an extra layer of security to your account with a TOTP authenticator app.
                        </p>
                    </div>
                    {step === "idle" && (
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                            is2FAEnabled
                                ? "bg-[#248046]/20 text-[#57f287]"
                                : "bg-[#72767d]/20 text-[#949ba4]"
                        }`}>
                            {is2FAEnabled ? "Enabled" : "Disabled"}
                        </span>
                    )}
                </div>

                {error && (
                    <div className="px-3 py-2 rounded bg-[#f23f43]/10 border border-[#f23f43]/30 text-[#f23f43] text-sm">
                        {error}
                    </div>
                )}

                {/* ── Idle state ── */}
                {step === "idle" && !is2FAEnabled && (
                    <button
                        onClick={handleSetup}
                        disabled={loading}
                        className="px-4 py-2 rounded bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {loading && <Spinner size="sm" />}
                        Enable Two-Factor Auth
                    </button>
                )}

                {step === "idle" && is2FAEnabled && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setStep("regenerate-confirm"); setError(""); }}
                            className="px-4 py-2 rounded bg-[#72767d] hover:bg-[#5d6169] text-white text-sm font-medium transition-colors"
                        >
                            Regenerate Recovery Codes
                        </button>
                        <button
                            onClick={() => { setStep("disable-confirm"); setError(""); }}
                            className="px-4 py-2 rounded bg-[#da373c] hover:bg-[#a12828] text-white text-sm font-medium transition-colors"
                        >
                            Disable 2FA
                        </button>
                    </div>
                )}

                {/* ── Setup: show QR code ── */}
                {step === "setup" && (
                    <div className="space-y-4">
                        <p className="text-sm text-[#dbdee1]">
                            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
                        </p>
                        <div className="flex justify-center">
                            <div className="bg-white p-3 rounded-lg inline-block">
                                <QRCodeSVG value={authenticatorUri} size={200} />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-[#949ba4] mb-1">Or enter this key manually:</p>
                            <code className="block px-3 py-2 rounded bg-[#1e1f22] text-[#57f287] text-sm font-mono select-all break-all">
                                {sharedKey}
                            </code>
                        </div>

                        <label className="block">
                            <span className="text-xs font-bold text-[#b5bac1] uppercase">
                                Verify Code
                            </span>
                            <input
                                type="text"
                                maxLength={6}
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                                onKeyDown={e => e.key === "Enter" && handleEnable()}
                                placeholder="000000"
                                autoFocus
                                className="w-full mt-1 px-3 py-2 rounded bg-[#1e1f22] text-white outline-none border border-[#3f4147] focus:border-[#5865F2] tracking-[0.3em] text-center text-lg"
                            />
                        </label>

                        <div className="flex gap-2">
                            <button
                                onClick={handleEnable}
                                disabled={loading || totpCode.length !== 6}
                                className="px-4 py-2 rounded bg-[#248046] hover:bg-[#1a6334] text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {loading && <Spinner size="sm" />}
                                Activate
                            </button>
                            <button
                                onClick={resetState}
                                className="px-4 py-2 rounded text-sm text-[#949ba4] hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Recovery codes display ── */}
                {step === "recovery-codes" && (
                    <div className="space-y-4">
                        <div className="bg-[#2d2000] border border-[#faa61a]/30 rounded-lg px-4 py-3">
                            <p className="text-sm text-[#faa61a] font-medium mb-1">Save your recovery codes</p>
                            <p className="text-xs text-[#faa61a]/70">
                                Store these codes somewhere safe. Each code can only be used once. If you lose access to your authenticator app, you'll need these to log in.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {recoveryCodes.map((code) => (
                                <code key={code} className="px-3 py-2 rounded bg-[#1e1f22] text-[#dbdee1] text-sm font-mono text-center">
                                    {code}
                                </code>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(recoveryCodes.join("\n"));
                                    toast("Recovery codes copied!", "success");
                                }}
                                className="px-4 py-2 rounded bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-medium transition-colors"
                            >
                                Copy All
                            </button>
                            <button
                                onClick={resetState}
                                className="px-4 py-2 rounded bg-[#248046] hover:bg-[#1a6334] text-white text-sm font-medium transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Disable confirmation ── */}
                {step === "disable-confirm" && (
                    <div className="space-y-3">
                        <p className="text-sm text-[#dbdee1]">Enter your password to disable two-factor authentication:</p>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleDisable()}
                            placeholder="Password"
                            autoFocus
                            className="w-full px-3 py-2 rounded bg-[#1e1f22] text-white outline-none border border-[#3f4147] focus:border-[#5865F2]"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleDisable}
                                disabled={loading || !password}
                                className="px-4 py-2 rounded bg-[#da373c] hover:bg-[#a12828] text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {loading && <Spinner size="sm" />}
                                Disable 2FA
                            </button>
                            <button
                                onClick={resetState}
                                className="px-4 py-2 rounded text-sm text-[#949ba4] hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Regenerate recovery codes confirmation ── */}
                {step === "regenerate-confirm" && (
                    <div className="space-y-3">
                        <p className="text-sm text-[#dbdee1]">Enter your password to generate new recovery codes. This will invalidate all existing codes.</p>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleRegenerate()}
                            placeholder="Password"
                            autoFocus
                            className="w-full px-3 py-2 rounded bg-[#1e1f22] text-white outline-none border border-[#3f4147] focus:border-[#5865F2]"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleRegenerate}
                                disabled={loading || !password}
                                className="px-4 py-2 rounded bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {loading && <Spinner size="sm" />}
                                Regenerate
                            </button>
                            <button
                                onClick={resetState}
                                className="px-4 py-2 rounded text-sm text-[#949ba4] hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </section>

        </div>
    );
}

