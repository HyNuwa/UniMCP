// stderr, porque en STDIO stdout es el canal del protocolo.
export const logger = {
    info: (...args: unknown[]) => console.error("[mcp-uni-arg]", ...args),
    warn: (...args: unknown[]) => console.error("[mcp-uni-arg] WARN", ...args),
    error: (...args: unknown[]) => console.error("[mcp-uni-arg] ERROR", ...args),
};
