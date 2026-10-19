import { logger } from "../shared/logger.js";

export type AccessDecision = { allowed: true } | { allowed: false; reason: string; url?: string };

/** Decide quién puede usar el servidor, a partir del usuario que acaba de entrar al aula. */
export type AccessPolicy = (user: { campus: string; username: string; email: string | null }) => Promise<AccessDecision>;

/** Tiempo máximo de espera de MCP_UNI_ACCESS_URL, en milisegundos. */
const ACCESS_TIMEOUT_MS = 5_000;

/** Respuesta de MCP_UNI_ACCESS_URL. */
interface RemoteDecision {
    permitido?: boolean;
    motivo?: string;
    url?: string;
}

/**
 * La política se configura por entorno: MCP_UNI_ACCESS_URL delega en otro servicio,
 * MCP_UNI_ALLOWED_EMAILS usa una lista, y sin ninguna entra cualquiera que tenga usuario en un aula del
 * registro.
 */
export function accessPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): AccessPolicy {
    if (env.MCP_UNI_ACCESS_URL) return remotePolicy(env.MCP_UNI_ACCESS_URL, env.MCP_UNI_ACCESS_SECRET);
    if (env.MCP_UNI_ALLOWED_EMAILS) return listPolicy(env.MCP_UNI_ALLOWED_EMAILS);
    logger.warn("Sin MCP_UNI_ACCESS_URL ni MCP_UNI_ALLOWED_EMAILS: puede entrar cualquiera con usuario de un aula del registro.");
    return async () => ({ allowed: true });
}

/** Emails o dominios (`@fi.unju.edu.ar`) separados por coma. */
function listPolicy(raw: string): AccessPolicy {
    const entries = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    return async ({ email }) => {
        const own = email?.toLowerCase();
        if (own && entries.some((e) => (e.startsWith("@") ? own.endsWith(e) : own === e))) return { allowed: true };
        return { allowed: false, reason: "Tu cuenta no está habilitada en este servidor. Pedile acceso a quien lo administra." };
    };
}

/** `POST url` con `{ email, usuario, campus }`; la respuesta es `{ permitido, motivo?, url? }`. */
function remotePolicy(url: string, secret: string | undefined): AccessPolicy {
    if (!secret) logger.warn("MCP_UNI_ACCESS_URL sin MCP_UNI_ACCESS_SECRET: el pedido de acceso va sin autenticar.");
    return async ({ campus, username, email }) => {
        if (!email) return { allowed: false, reason: "El aula no devolvió tu email, y sin él no podemos verificar tu acceso." };
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json", ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
                body: JSON.stringify({ email, usuario: username, campus }),
                signal: AbortSignal.timeout(ACCESS_TIMEOUT_MS),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as RemoteDecision;
            if (data.permitido === true) return { allowed: true };
            return { allowed: false, reason: data.motivo || "Tu cuenta no está habilitada en este servidor.", url: data.url };
        } catch (e) {
            logger.error(`No se pudo consultar el acceso de ${email}: ${(e as Error).message}`);
            return { allowed: false, reason: "No pudimos verificar si tenés acceso: probá de nuevo en unos minutos." };
        }
    };
}
