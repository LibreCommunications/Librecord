import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";

export type ToastType = "success" | "error" | "info";

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    exiting?: boolean;
}

export interface ToastContextValue {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const TOAST_DURATION = 3500;
const EXIT_DURATION = 200;

let nextId = 0;

const icons: Record<ToastType, React.ReactNode> = {
    success: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
        </svg>
    ),
    error: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    ),
    info: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    ),
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const toast = useCallback((message: string, type: ToastType = "info") => {
        const id = nextId++;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, EXIT_DURATION);
        }, TOAST_DURATION);
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail;
            toast(message, type);
        };
        window.addEventListener("app:toast", handler);
        return () => window.removeEventListener("app:toast", handler);
    }, [toast]);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        style={{ animation: t.exiting ? `toastOut ${EXIT_DURATION}ms ease-in forwards` : `toastIn 0.25s cubic-bezier(0.16,1,0.3,1)` }}
                        className={`
                            pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-sm font-medium cursor-pointer
                            backdrop-blur-sm border border-white/5
                            ${t.type === "success" ? "bg-[#248046]/95 text-white" : ""}
                            ${t.type === "error" ? "bg-[#da373c]/95 text-white" : ""}
                            ${t.type === "info" ? "bg-[#5865F2]/95 text-white" : ""}
                        `}
                        onClick={() => {
                            setToasts(prev => prev.map(x => x.id === t.id ? { ...x, exiting: true } : x));
                            setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), EXIT_DURATION);
                        }}
                    >
                        <span className="shrink-0 opacity-90">{icons[t.type]}</span>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export { ToastContext };
