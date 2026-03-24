import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { presence } from "../api/client";

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
        presence.me()
            .then(data => { if (data?.status) setStatus(data.status); })
            .catch(() => {});
    }, [user?.userId]);

    const setMyStatus = useCallback(async (status: string) => {
        await presence.set(status);
        setStatus(status);
    }, []);

    return (
        <PresenceContext.Provider value={{ myStatus, setMyStatus }}>
            {children}
        </PresenceContext.Provider>
    );
}

export { PresenceContext };
