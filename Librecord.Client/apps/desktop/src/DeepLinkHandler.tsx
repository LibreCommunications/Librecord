import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGuildInvites } from "@librecord/app";

export function DeepLinkHandler() {
    const navigate = useNavigate();
    const { joinByCode } = useGuildInvites();

    useEffect(() => {
        function handleInvite(e: Event) {
            const { code } = (e as CustomEvent<{ code: string }>).detail;
            joinByCode(code).then((result) => {
                if (result.ok) {
                    navigate(`/app/guild/${result.guild.id}`);
                }
            });
        }

        window.addEventListener("deep-link:invite", handleInvite);
        return () => window.removeEventListener("deep-link:invite", handleInvite);
    }, [navigate, joinByCode]);

    return null;
}
