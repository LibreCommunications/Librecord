import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setRefreshFunction } from "@librecord/api-client";

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
    emailVerified?: boolean;
    requiresEmailVerification?: boolean;
    twoFactorEnabled?: boolean;
}

export interface LoginResult {
    error?: string;
    requiresTwoFactor?: boolean;
    twoFactorSessionToken?: string;
    requiresEmailVerification?: boolean;
    userId?: string;
}

export interface AuthContextType {
    user: AuthUser | null;

    isAuthenticated: boolean;
    authLoading: boolean;

    login: (emailOrUsername: string, password: string) => Promise<LoginResult>;

    register: (
        email: string,
        username: string,
        displayName: string,
        password: string
    ) => Promise<LoginResult>;
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
            emailVerified: data.emailVerified,
            requiresEmailVerification: data.requiresEmailVerification,
            twoFactorEnabled: data.twoFactorEnabled,
        });
    }, [refreshAccessToken]);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        let cancelled = false;

        (async () => {
            try {
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
                                emailVerified: data.emailVerified,
                                requiresEmailVerification: data.requiresEmailVerification,
                                twoFactorEnabled: data.twoFactorEnabled,
                            });
                        } else {
                            setUser(null);
                        }
                    } else {
                        setUser(null);
                    }
                }
            } catch {
                if (!cancelled) setUser(null);
            } finally {
                if (!cancelled) setAuthLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [refreshAccessToken]);

    const login = useCallback(async (
        emailOrUsername: string,
        password: string
    ): Promise<LoginResult> => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ emailOrUsername, password }),
        });

        const data = await res.json();

        // 2FA required — don't load user yet, return session token
        if (data.requiresTwoFactor) {
            return {
                requiresTwoFactor: true,
                twoFactorSessionToken: data.twoFactorSessionToken,
            };
        }

        // Email verification required (post-cutoff account)
        if (!res.ok && data.requiresEmailVerification) {
            return {
                requiresEmailVerification: true,
                userId: data.userId,
                error: data.error,
            };
        }

        if (!res.ok || !data.success) {
            return { error: data.error ?? "Login failed" };
        }

        await loadUser();
        return {};
    }, [loadUser]);

    const register = useCallback(async (
        email: string,
        username: string,
        displayName: string,
        password: string
    ): Promise<LoginResult> => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, username, displayName, password }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            return { error: data.error ?? "Registration failed" };
        }

        await loadUser();

        if (data.requiresEmailVerification) {
            return { requiresEmailVerification: true };
        }

        return {};
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
