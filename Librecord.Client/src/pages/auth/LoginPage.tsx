import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Spinner } from "../../components/ui/Spinner";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [emailOrUsername, setEmailOrUsername] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin() {
        setError("");
        setLoading(true);

        const errorMessage = await login(emailOrUsername, password);

        setLoading(false);

        if (errorMessage) {
            setError(errorMessage);
            return;
        }

        navigate("/app");
    }

    return (
        <div className="h-screen w-full flex items-center justify-center bg-[#5865F2]">
            <div className="w-[480px] bg-[#313338] p-8 rounded-2xl shadow-2xl animate-[scaleIn_0.2s_ease-out]">
                <h1 className="text-2xl font-bold text-white mb-1 text-center">
                    Welcome back!
                </h1>
                <p className="text-sm text-[#949ba4] mb-6 text-center">
                    We're so excited to see you again!
                </p>

                {error && (
                    <div className="mb-4 px-3 py-2 rounded bg-[#f23f43]/10 border border-[#f23f43]/30 text-[#f23f43] text-sm">
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
                        className="input-field mt-2"
                    />
                </label>

                <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full py-2.5 rounded-[4px] font-semibold text-white bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                    {loading && <Spinner size="sm" />}
                    {loading ? "Logging in..." : "Log In"}
                </button>

                <p className="mt-3 text-sm text-[#949ba4]">
                    Need an account?{" "}
                    <a href="/register" className="text-[#00a8fc] hover:underline">
                        Register
                    </a>
                </p>
            </div>
        </div>
    );
}
