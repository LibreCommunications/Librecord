import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@librecord/design/src/index.css'
import App from './App.tsx'
import { AuthProvider, ToastProvider, PresenceProvider } from "@librecord/app";
import { ErrorBoundary } from "@librecord/ui-web/src/components/ui/ErrorBoundary.tsx";
import { WebPlatformProvider } from "@librecord/platform-web";
import { setHttpClient, setEventBus, setConnectionEventBus } from "@librecord/api-client";
import { webHttpClient, webEventBus } from "@librecord/platform-web";
import { BrowserRouter } from "react-router-dom";

// Wire platform adapters into api-client
setHttpClient(webHttpClient);
setEventBus(webEventBus);
setConnectionEventBus(webEventBus);

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <WebPlatformProvider>
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
        </WebPlatformProvider>
    </ErrorBoundary>
);
