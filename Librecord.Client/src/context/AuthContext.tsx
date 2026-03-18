import { createContext, useContext, useEffect, useRef, useState } from "react";

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

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        init();
    }, []);

    async function init() {
        try {
            await loadUser();
        } finally {
            setAuthLoading(false);
        }
    }

    // ------------------------
    // LOAD USER
    // ------------------------
    async function loadUser() {
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
    }

    // ------------------------
    // REFRESH TOKEN
    // ------------------------
    async function refreshAccessToken(): Promise<boolean> {
        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            credentials: "include",
        });

        return res.ok;
    }

    // ------------------------
    // LOGIN
    // ------------------------
    async function login(
        emailOrUsername: string,
        password: string
    ): Promise<string | null> {
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
    }


    // ------------------------
    // REGISTER
    // ------------------------
    async function register(
        email: string,
        username: string,
        displayName: string,
        password: string
    ): Promise<string | null> {
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
    }

    // ------------------------
    // LOGOUT
    // ------------------------
    async function logout() {
        await fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            credentials: "include",
        });

        setUser(null);
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated,
                authLoading,
                login,
                register,
                logout,
                loadUser,
                refreshAccessToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
