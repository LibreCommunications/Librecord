import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Spinner } from "../../components/ui/Spinner";

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleRegister() {
        setError("");
        setLoading(true);

        const errorMessage = await register(email, username, displayName, password);

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
                    Create an account
                </h1>
                <p className="text-sm text-[#949ba4] mb-6 text-center">
                    Join Librecord and start chatting!
                </p>

                {error && (
                    <div className="mb-4 px-3 py-2 rounded bg-[#f23f43]/10 border border-[#f23f43]/30 text-[#f23f43] text-sm">
                        {error}
                    </div>
                )}

                <label className="block mb-4">
                    <span className="text-xs font-bold uppercase text-[#b5bac1] tracking-wide">
                        Email
                        <span className="text-[#f23f43] ml-0.5">*</span>
                    </span>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full mt-2 px-3 py-2.5 rounded-[4px] bg-[#1e1f22] text-white outline-none border border-[#1e1f22] focus:border-[#5865F2] transition-colors"
                    />
                </label>

                <label className="block mb-4">
                    <span className="text-xs font-bold uppercase text-[#b5bac1] tracking-wide">
                        Username
                        <span className="text-[#f23f43] ml-0.5">*</span>
                    </span>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full mt-2 px-3 py-2.5 rounded-[4px] bg-[#1e1f22] text-white outline-none border border-[#1e1f22] focus:border-[#5865F2] transition-colors"
                    />
                </label>

                <label className="block mb-4">
                    <span className="text-xs font-bold uppercase text-[#b5bac1] tracking-wide">
                        Display Name
                    </span>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full mt-2 px-3 py-2.5 rounded-[4px] bg-[#1e1f22] text-white outline-none border border-[#1e1f22] focus:border-[#5865F2] transition-colors"
                    />
                </label>

                <label className="block mb-6">
                    <span className="text-xs font-bold uppercase text-[#b5bac1] tracking-wide">
                        Password
                        <span className="text-[#f23f43] ml-0.5">*</span>
                    </span>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleRegister()}
                        className="w-full mt-2 px-3 py-2.5 rounded-[4px] bg-[#1e1f22] text-white outline-none border border-[#1e1f22] focus:border-[#5865F2] transition-colors"
                    />
                </label>

                <button
                    onClick={handleRegister}
                    disabled={loading}
                    className="w-full py-2.5 rounded-[4px] font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
