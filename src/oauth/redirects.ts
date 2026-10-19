/** Destinos permitidos para el navegador al terminar el login. */
export interface RedirectAllowlist {
    /** Hostnames a los que se vuelve por HTTPS sin mostrar aviso. */
    hosts: Set<string>;
    /** Esquemas de apps instaladas, con los dos puntos (`cursor:`). */
    schemes: Set<string>;
}

/**
 * Callbacks de los clientes MCP conocidos (Claude, ChatGPT, Grok, Gemini, VS Code web) y esquemas de
 * editores.
 */
const DEFAULT_HOSTS = [
    "claude.ai",
    "claude.com",
    "chatgpt.com",
    "chat.openai.com",
    "grok.com",
    "gemini.google.com",
    "vscode.dev",
    "insiders.vscode.dev",
];
const DEFAULT_SCHEMES = ["cursor:", "vscode:", "vscode-insiders:", "windsurf:"];

/**
 * En loopback la redirección no sale de la compu del usuario, donde escuchan los clientes de
 * escritorio.
 */
const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Los destinos conocidos más los de UNIMCP_REDIRECT_ALLOW, separados por coma: hosts
 * (`app.ejemplo.com`) o esquemas con dos puntos al final (`miapp:`).
 */
export function redirectAllowlistFromEnv(env: NodeJS.ProcessEnv = process.env): RedirectAllowlist {
    const extra = (env.UNIMCP_REDIRECT_ALLOW ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    return {
        hosts: new Set([...DEFAULT_HOSTS, ...extra.filter((e) => !e.endsWith(":"))]),
        schemes: new Set([...DEFAULT_SCHEMES, ...extra.filter((e) => e.endsWith(":"))]),
    };
}

/**
 * `trusted`: loopback, un host HTTPS de la lista o el esquema de una app de la lista.
 * `unknown`: otro host HTTPS, por ejemplo el de un agente propio; pasa con aviso.
 * `rejected`: todo lo demás.
 */
export function redirectTrust(uri: unknown, allow: RedirectAllowlist): "trusted" | "unknown" | "rejected" {
    if (typeof uri !== "string") return "rejected";
    let url: URL;
    try {
        url = new URL(uri);
    } catch {
        return "rejected";
    }
    if (url.hash || url.username || url.password) return "rejected";
    if (url.protocol === "http:" || url.protocol === "https:") {
        if (LOOPBACK.includes(url.hostname)) return "trusted";
        if (url.protocol === "http:") return "rejected";
        return allow.hosts.has(url.hostname) ? "trusted" : "unknown";
    }
    return allow.schemes.has(url.protocol) ? "trusted" : "rejected";
}

/** Nombre del destino tal como se le muestra al usuario. */
export function describeRedirect(uri: string): string {
    const url = new URL(uri);
    if (LOOPBACK.includes(url.hostname)) return "una app en tu compu";
    if (url.protocol === "https:") return url.hostname;
    return `la app ${url.protocol.slice(0, -1)}`;
}
