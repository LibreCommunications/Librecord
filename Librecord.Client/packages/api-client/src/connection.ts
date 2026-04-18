import * as signalR from "@microsoft/signalr";
import { logger } from "@librecord/domain";
import type { EventBus } from "@librecord/platform";
import { API_URL } from "./client.ts";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

let _state: ConnectionState = "disconnected";
const _stateListeners: Set<() => void> = new Set();

let _eventBus: EventBus | null = null;
let _onReconnected: (() => Promise<void>) | null = null;
let _onDisconnected: (() => Promise<void>) | null = null;
let _shouldRetryOnClose: (() => boolean) | null = null;
let _onRegisterListeners: (() => void) | null = null;

export function getConnectionState(): ConnectionState { return _state; }

export function subscribeConnectionState(cb: () => void): () => void {
    _stateListeners.add(cb);
    return () => { _stateListeners.delete(cb); };
}

export function setConnectionState(s: ConnectionState) {
    _state = s;
    _stateListeners.forEach(cb => cb());
}

export function setConnectionEventBus(bus: EventBus) {
    _eventBus = bus;
}

export function setConnectionHooks(hooks: {
    onReconnected?: () => Promise<void>;
    onDisconnected?: () => Promise<void>;
    shouldRetryOnClose?: () => boolean;
    onRegisterListeners?: () => void;
}) {
    _onReconnected = hooks.onReconnected ?? null;
    _onDisconnected = hooks.onDisconnected ?? null;
    _shouldRetryOnClose = hooks.shouldRetryOnClose ?? null;
    _onRegisterListeners = hooks.onRegisterListeners ?? null;
}

const reconnectPolicy: signalR.IRetryPolicy = {
    nextRetryDelayInMilliseconds(retryContext) {
        const elapsed = retryContext.elapsedMilliseconds;
        if (elapsed > 5 * 60_000) return null;
        return Math.min(1000 * Math.pow(1.5, retryContext.previousRetryCount), 15_000);
    },
};

// Built lazily on first access via the Proxy below so the connection URL uses
// the API_URL that was configured by setApiUrl() at app startup, not the empty
// string that existed when this module was first loaded.
let _built: signalR.HubConnection | null = null;

function build(): signalR.HubConnection {
    const conn = new signalR.HubConnectionBuilder()
        .withUrl(`${API_URL}/hubs/app`, { withCredentials: true })
        .withAutomaticReconnect(reconnectPolicy)
        .build();

    conn.keepAliveIntervalInMilliseconds = 10_000;
    conn.serverTimeoutInMilliseconds = 60_000;

    conn.onreconnected(async () => {
        _onRegisterListeners?.();
        setConnectionState("connected");
        if (_onReconnected) {
            try { await _onReconnected(); }
            catch (e) { logger.realtime.warn("Reconnect hook failed", e); }
        }
        _eventBus?.dispatchPlain("realtime:reconnected");
    });

    conn.onreconnecting(err => {
        logger.realtime.warn("Reconnecting...", err?.message);
        setConnectionState("reconnecting");
    });

    conn.onclose(async (err) => {
        logger.realtime.warn("Connection closed", err?.message);
        const shouldRetry = _shouldRetryOnClose?.() ?? false;

        if (shouldRetry) {
            logger.realtime.info("Was in voice call — attempting fresh connection...");
            setConnectionState("reconnecting");
            try {
                await conn.start();
                _onRegisterListeners?.();
                setConnectionState("connected");
                if (_onReconnected) {
                    try { await _onReconnected(); }
                    catch (e) { logger.realtime.warn("Reconnect hook failed", e); }
                }
                _eventBus?.dispatchPlain("realtime:reconnected");
                return;
            } catch (e) {
                logger.realtime.warn("Fresh connection failed", e);
            }
        }

        setConnectionState("disconnected");

        if (_onDisconnected) {
            try { await _onDisconnected(); }
            catch (e) { logger.realtime.warn("Disconnect hook failed", e); }
        }
    });

    return conn;
}

function ensure(): signalR.HubConnection {
    if (!_built) _built = build();
    return _built;
}

export const appConnection = new Proxy({} as signalR.HubConnection, {
    get(_t, prop) {
        const c = ensure();
        const value = (c as unknown as Record<string | symbol, unknown>)[prop];
        return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(c) : value;
    },
    set(_t, prop, value) {
        const c = ensure();
        (c as unknown as Record<string | symbol, unknown>)[prop] = value;
        return true;
    },
});
