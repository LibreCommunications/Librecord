type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: LogLevel = import.meta.env.DEV ? "debug" : "warn";

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

function log(level: LogLevel, category: string, msg: string, ...args: unknown[]) {
    if (!shouldLog(level)) return;
    const color = COLORS[category] ?? "#9ca3af";
    const prefix = `%c[${category}]`;
    const style = `color:${color};font-weight:bold`;
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(prefix, style, msg, ...args);
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
