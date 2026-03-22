import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { PresenceProvider } from "./context/PresenceContext";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { BrowserRouter } from "react-router-dom";

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <AuthProvider>
            <StrictMode>
                <BrowserRouter>
                    <PresenceProvider>
                        <ToastProvider>
                            <App />
                        </ToastProvider>
                    </PresenceProvider>
                </BrowserRouter>
            </StrictMode>
        </AuthProvider>
    </ErrorBoundary>
);
