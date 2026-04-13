import { useState } from "react";
import { useAuth } from "@librecord/app";
import { auth } from "@librecord/api-client";
import { CloseIcon } from "./Icons";

export function EmailVerificationBanner() {
    const { user } = useAuth();
    const [dismissed, setDismissed] = useState(false);
    const [sent, setSent] = useState(false);

    if (!user || user.emailVerified || !user.requiresEmailVerification || dismissed) return null;

    async function handleResend() {
        try {
            await auth.resendVerification();
            setSent(true);
        } catch { /* ignore */ }
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-[#faa61a] text-black text-sm px-4 py-2">
            <span>Your email is not verified. Please check your inbox.</span>
            <button
                onClick={handleResend}
                disabled={sent}
                className="font-medium underline underline-offset-2 hover:text-black/70 disabled:opacity-50"
            >
                {sent ? "Email sent!" : "Resend"}
            </button>
            <button
                onClick={() => setDismissed(true)}
                className="text-black/40 hover:text-black ml-1"
            >
                <CloseIcon size={14} />
            </button>
        </div>
    );
}
