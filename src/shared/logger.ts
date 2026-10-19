// stderr, porque en STDIO stdout es el canal del protocolo.
export const logger = {
    info: (...args: unknown[]) => console.error("[unimcp]", ...args),
    warn: (...args: unknown[]) => console.error("[unimcp] WARN", ...args),
    error: (...args: unknown[]) => console.error("[unimcp] ERROR", ...args),
};
