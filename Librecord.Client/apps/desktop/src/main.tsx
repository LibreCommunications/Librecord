import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@librecord/design/src/index.css'
import App from './App.tsx'
import { AuthProvider, ToastProvider, PresenceProvider } from "@librecord/app";
import { ErrorBoundary } from "@librecord/ui-web/src/components/ui/ErrorBoundary.tsx";
import { ElectronPlatformProvider } from "@librecord/platform-electron";
import { setHttpClient, setEventBus, setConnectionEventBus } from "@librecord/api-client";
import { webHttpClient, webEventBus } from "@librecord/platform-web";
import { getElectronAPI } from "@librecord/domain";
import { HashRouter } from "react-router-dom";

// Wire platform adapters into api-client
setHttpClient(webHttpClient);
setEventBus(webEventBus);
setConnectionEventBus(webEventBus);

const electronAPI = getElectronAPI();

// Listen for notification click-to-navigate from main process
electronAPI?.onNavigate((channelId) => {
    // channelId could be a DM channel or guild channel — navigate to it
    if (channelId.includes("/")) {
        window.location.hash = `#/app/${channelId}`;
    } else {
        window.location.hash = `#/app/dm/${channelId}`;
    }
});

// Listen for deep links from main process
electronAPI?.onDeepLink((link) => {
    switch (link.type) {
        case "guild":
            window.location.hash = link.params.length > 1
                ? `#/app/guild/${link.params[0]}/${link.params[1]}`
                : `#/app/guild/${link.params[0]}`;
            break;
        case "dm":
            window.location.hash = `#/app/dm/${link.params[0]}`;
            break;
        case "invite":
            window.location.hash = "#/app/dm";
            window.dispatchEvent(new CustomEvent("deep-link:invite", {
                detail: { code: link.params[0] },
            }));
            break;
    }
});

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <ElectronPlatformProvider>
            <AuthProvider>
                <StrictMode>
                    <HashRouter>
                        <PresenceProvider>
                            <ToastProvider>
                                <App />
                            </ToastProvider>
                        </PresenceProvider>
                    </HashRouter>
                </StrictMode>
            </AuthProvider>
        </ElectronPlatformProvider>
    </ErrorBoundary>
);
