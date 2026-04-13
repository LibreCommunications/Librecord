import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { auth } from "@librecord/api-client";
import { Spinner } from "../../components/ui/Spinner";

export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [error, setError] = useState("");
    const attempted = useRef(false);

    useEffect(() => {
        if (attempted.current) return;
        attempted.current = true;

        const userId = searchParams.get("userId");
        const token = searchParams.get("token");

        if (!userId || !token) {
            setError("Invalid verification link.");
            setStatus("error");
            return;
        }

        auth.verifyEmail(userId, token)
            .then(() => setStatus("success"))
            .catch(() => {
                setError("Invalid or expired verification link.");
                setStatus("error");
            });
    }, [searchParams]);

    return (
        <div className="h-screen w-full flex items-center justify-center bg-[#5865F2] relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#3b44c4]/40 blur-[120px] animate-[drift_20s_ease-in-out_infinite]" />
                <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-[#7983f5]/30 blur-[100px] animate-[drift_25s_ease-in-out_infinite_reverse]" />
            </div>
            <div className="w-[480px] bg-[#313338] p-8 rounded-2xl shadow-2xl relative z-10 text-center">
                <div className="flex justify-center mb-6">
                    <img src="/librecord.svg" alt="Librecord" className="w-14 h-14" />
                </div>

                {status === "loading" && (
                    <>
                        <h1 className="text-2xl font-bold text-white mb-4">Verifying your email...</h1>
                        <Spinner size="lg" />
                    </>
                )}

                {status === "success" && (
                    <>
                        <h1 className="text-2xl font-bold text-white mb-2">Email verified!</h1>
                        <p className="text-sm text-[#949ba4] mb-6">
                            Your email has been verified. You can now log in.
                        </p>
                        <a
                            href="/login"
                            className="inline-block px-6 py-2.5 rounded-[4px] font-semibold text-white bg-[#5865F2] hover:bg-[#4752c4] transition-colors"
                        >
                            Go to Login
                        </a>
                    </>
                )}

                {status === "error" && (
                    <>
                        <h1 className="text-2xl font-bold text-white mb-2">Verification failed</h1>
                        <p className="text-sm text-[#f23f43] mb-6">{error}</p>
                        <a
                            href="/login"
                            className="inline-block px-6 py-2.5 rounded-[4px] font-semibold text-white bg-[#5865F2] hover:bg-[#4752c4] transition-colors"
                        >
                            Go to Login
                        </a>
                    </>
                )}
            </div>
        </div>
    );
}
