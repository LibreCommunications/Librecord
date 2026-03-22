import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
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
    const auth = useAuth();
    const [myStatus, setStatus] = useState("online");

    useEffect(() => {
        if (!auth.user) return;
        fetchWithAuth(`${API_URL}/presence/me`, {}, auth)
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data?.status) setStatus(data.status); });
    }, [auth, auth.user?.userId]);

    const setMyStatus = useCallback(async (status: string) => {
        await fetchWithAuth(
            `${API_URL}/presence`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            },
            auth
        );
        setStatus(status);
    }, [auth]);

    return (
        <PresenceContext.Provider value={{ myStatus, setMyStatus }}>
            {children}
        </PresenceContext.Provider>
    );
}

export function usePresence() {
    return useContext(PresenceContext);
}
