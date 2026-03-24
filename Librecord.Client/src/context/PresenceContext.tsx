import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

interface PresenceContextValue {
    myStatus: string;
    setMyStatus: (status: string) => Promise<void>;
}

const PresenceContext = createContext<PresenceContextValue>({
    myStatus: "online",
    setMyStatus: async () => {},
});

export function PresenceProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [myStatus, setStatus] = useState("online");

    useEffect(() => {
        if (!user) return;
        fetchWithAuth(`${API_URL}/presence/me`, {})
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data?.status) setStatus(data.status); });
    }, [user?.userId]);

    const setMyStatus = useCallback(async (status: string) => {
        await fetchWithAuth(
            `${API_URL}/presence`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            },
        );
        setStatus(status);
    }, []);

    return (
        <PresenceContext.Provider value={{ myStatus, setMyStatus }}>
            {children}
        </PresenceContext.Provider>
    );
}

export { PresenceContext };
