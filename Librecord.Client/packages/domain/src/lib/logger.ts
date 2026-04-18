type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
// Works on both Vite (NODE_ENV replaced at build) and Metro (__DEV__ global).
declare const __DEV__: boolean | undefined;
const IS_DEV =
    (typeof __DEV__ !== "undefined" && __DEV__) ||
    (typeof process !== "undefined" && process.env?.NODE_ENV !== "production");
const MIN_LEVEL: LogLevel = IS_DEV ? "debug" : "warn";

const COLORS: Record<string, string> = {
    Voice: "#4ade80",
    Realtime: "#60a5fa",
    RNNoise: "#c084fc",
    API: "#fbbf24",
    Typing: "#94a3b8",
    UI: "#f472b6",
};

function shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

// Browsers understand `%c` CSS formatting; React Native's console does not and
// prints the style string as literal text, so only use %c where it works.
const IS_BROWSER_CONSOLE =
    typeof navigator === "undefined" || navigator.product !== "ReactNative";

function log(level: LogLevel, category: string, msg: string, ...args: unknown[]) {
    if (!shouldLog(level)) return;
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

    if (IS_BROWSER_CONSOLE) {
        const color = COLORS[category] ?? "#9ca3af";
        fn(`%c[${category}]`, `color:${color};font-weight:bold`, msg, ...args);
    } else {
        fn(`[${category}]`, msg, ...args);
    }
}

function createCategoryLogger(category: string) {
    return {
        debug: (msg: string, ...args: unknown[]) => log("debug", category, msg, ...args),
        info: (msg: string, ...args: unknown[]) => log("info", category, msg, ...args),
        warn: (msg: string, ...args: unknown[]) => log("warn", category, msg, ...args),
        error: (msg: string, ...args: unknown[]) => log("error", category, msg, ...args),
    };
}

export const logger = {
    voice: createCategoryLogger("Voice"),
    realtime: createCategoryLogger("Realtime"),
    rnnoise: createCategoryLogger("RNNoise"),
    api: createCategoryLogger("API"),
    typing: createCategoryLogger("Typing"),
    ui: createCategoryLogger("UI"),
};
