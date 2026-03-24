import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setRefreshFunction } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface GuildSummary {
    guildId: string;
    name: string;
    iconUrl: string | null;
}

export interface AuthUser {
    userId: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
    guilds?: GuildSummary[];
}

export interface AuthContextType {
    user: AuthUser | null;

    isAuthenticated: boolean;
    authLoading: boolean;

    login: (emailOrUsername: string, password: string) => Promise<string | null>;

    register: (
        email: string,
        username: string,
        displayName: string,
        password: string
    ) => Promise<string | null>;
    logout: () => Promise<void>;
    loadUser: () => Promise<void>;
    refreshAccessToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>(null!);


export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const initialized = useRef(false);

    const isAuthenticated = !!user?.userId;

    const refreshAccessToken = useCallback(async (): Promise<boolean> => {
        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            credentials: "include",
        });
        return res.ok;
    }, []);

    // Register globally so fetchWithAuth can use it without passing auth around
    useEffect(() => {
        setRefreshFunction(refreshAccessToken);
    }, [refreshAccessToken]);

    const loadUser = useCallback(async () => {
        let res = await fetch(`${API_URL}/users/me`, {
            credentials: "include",
        });

        if (res.status === 401) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
                setUser(null);
                return;
            }

            res = await fetch(`${API_URL}/users/me`, {
                credentials: "include",
            });
        }

        if (!res.ok) {
            setUser(null);
            return;
        }

        const data = await res.json();

        if (!data.userId) {
            setUser(null);
            return;
        }

        setUser({
            userId: data.userId,
            username: data.username,
            displayName: data.displayName,
            email: data.email,
            avatarUrl: data.avatarUrl,
            guilds: data.guilds,
        });
    }, [refreshAccessToken]);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        let cancelled = false;

        (async () => {
            let res = await fetch(`${API_URL}/users/me`, { credentials: "include" });

            if (res.status === 401) {
                const refreshed = await refreshAccessToken();
                if (!refreshed) {
                    if (!cancelled) { setUser(null); setAuthLoading(false); }
                    return;
                }
                res = await fetch(`${API_URL}/users/me`, { credentials: "include" });
            }

            if (!cancelled) {
                if (res.ok) {
                    const data = await res.json();
                    if (data.userId) {
                        setUser({
                            userId: data.userId,
                            username: data.username,
                            displayName: data.displayName,
                            email: data.email,
                            avatarUrl: data.avatarUrl,
                            guilds: data.guilds,
                        });
                    } else {
                        setUser(null);
                    }
                } else {
                    setUser(null);
                }
                setAuthLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [refreshAccessToken]);

    const login = useCallback(async (
        emailOrUsername: string,
        password: string
    ): Promise<string | null> => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ emailOrUsername, password }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            return data.error ?? "Login failed";
        }

        await loadUser();
        return null;
    }, [loadUser]);

    const register = useCallback(async (
        email: string,
        username: string,
        displayName: string,
        password: string
    ): Promise<string | null> => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, username, displayName, password }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            return data.error ?? "Registration failed";
        }

        await loadUser();
        return null;
    }, [loadUser]);

    const logout = useCallback(async () => {
        await fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            credentials: "include",
        });

        setUser(null);
    }, []);

    const value = useMemo<AuthContextType>(() => ({
        user,
        isAuthenticated,
        authLoading,
        login,
        register,
        logout,
        loadUser,
        refreshAccessToken,
    }), [user, isAuthenticated, authLoading, login, register, logout, loadUser, refreshAccessToken]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export { AuthContext };
