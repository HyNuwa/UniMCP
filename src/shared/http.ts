import type { CookieJar } from "tough-cookie";
import { VERSION } from "./version.js";

/** Con quién habla el aula o Guaraní: si un admin ve tráfico raro, sabe de dónde viene. */
export const USER_AGENT = `unimcp/${VERSION} (+https://github.com/HyNuwa/UniMCP)`;

/**
 * `maybeProcessed`: el pedido pudo haber llegado y el servidor pudo haberlo hecho aunque no haya
 * respuesta (timeout, conexión cortada, un 5xx). Para una escritura, eso significa que no se sabe si se hizo.
 */
export class HttpError extends Error {
    constructor(
        message: string,
        readonly status?: number,
        readonly maybeProcessed = false,
    ) {
        super(message);
        this.name = "HttpError";
    }
}

/** Errores de red en los que el pedido no salió: el servidor no lo recibió. */
const NOT_SENT = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"]);

/** Reintentos ante 429 (y 503 en lo que se puede repetir), y la espera más larga que aceptamos. */
const RETRIES = 2;
const MAX_WAIT_MS = 10_000;

export interface PostOptions {
    timeoutMs?: number;
    /** Repetirlo no cambia nada (una lectura): se reintenta también ante 503. */
    idempotent?: boolean;
}

/**
 * POST application/x-www-form-urlencoded con respuesta JSON y timeout. Ante 429 reintenta, esperando lo
 * que diga `Retry-After`: el servidor rechazó el pedido sin hacerlo. Ante 503, solo si es `idempotent`.
 */
export async function postForm<T>(
    url: string,
    params: Record<string, string | number>,
    { timeoutMs = 30_000, idempotent = false }: PostOptions = {},
): Promise<T> {
    const { host, pathname } = new URL(url);
    const body = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
    );

    for (let attempt = 0; ; attempt++) {
        let res: Response;
        try {
            res = await fetch(url, {
                method: "POST",
                body,
                headers: { "user-agent": USER_AGENT },
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (e) {
            const err = e as Error & { cause?: { code?: string } };
            if (err.name === "TimeoutError") {
                throw new HttpError(`${host} no contestó en ${timeoutMs / 1000} s`, undefined, true);
            }
            const sent = !NOT_SENT.has(err.cause?.code ?? "");
            throw new HttpError(`No se pudo conectar con ${host}: ${err.message}`, undefined, sent);
        }

        const busy = res.status === 429 || (res.status === 503 && idempotent);
        if (busy && attempt < RETRIES) {
            const waitMs = retryAfterMs(res.headers.get("retry-after")) ?? 500 * 2 ** attempt;
            if (waitMs <= MAX_WAIT_MS) {
                await res.body?.cancel();
                await new Promise((resolve) => setTimeout(resolve, waitMs));
                continue;
            }
        }
        if (busy || res.status === 503) {
            throw new HttpError(`${host} está saturado (HTTP ${res.status}); probá de nuevo en un rato.`, res.status);
        }
        if (!res.ok) throw new HttpError(`HTTP ${res.status} en ${pathname}`, res.status, res.status >= 500);

        try {
            return (await res.json()) as T;
        } catch {
            throw new HttpError(`Respuesta no JSON en ${pathname}`, res.status, true);
        }
    }
}

/** `Retry-After` en milisegundos: viene en segundos o como fecha. */
function retryAfterMs(header: string | null): number | undefined {
    if (!header) return undefined;
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(header);
    return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** Cantidad de redirects que se siguen antes de abandonar. */
const MAX_REDIRECTS = 20;

/**
 * Request a un sitio con sesión por cookies (Guaraní): sigue los redirects a mano para guardar en `jar`
 * las cookies de cada salto, y devuelve la URL final y el HTML.
 */
export async function fetchWithCookies(
    jar: CookieJar,
    url: string,
    init?: { method?: string; body?: URLSearchParams },
    timeoutMs = 30_000,
): Promise<{ url: string; status: number; html: string }> {
    for (let i = 0; i < MAX_REDIRECTS; i++) {
        const cookie = await jar.getCookieString(url);
        let res: Response;
        try {
            res = await fetch(url, {
                ...init,
                redirect: "manual",
                headers: { "user-agent": USER_AGENT, ...(cookie && { cookie }) },
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (e) {
            throw new HttpError(`No se pudo conectar con ${new URL(url).host}: ${(e as Error).message}`);
        }
        for (const setCookie of res.headers.getSetCookie()) {
            await jar.setCookie(setCookie, url, { ignoreError: true });
        }

        const location = res.headers.get("location");
        if (res.status >= 300 && res.status < 400 && location) {
            await res.body?.cancel();
            url = new URL(location, url).toString();
            init = undefined; // después de un redirect se sigue con GET
            continue;
        }
        return { url, status: res.status, html: await decodeBody(res) };
    }
    throw new HttpError("Demasiadas redirecciones.");
}

/**
 * El cuerpo como texto en el charset que declara el servidor: `res.text()` asume UTF-8, y Guaraní de UNJu
 * manda ISO-8859-1, así que las tildes del menú llegaban como "�".
 */
async function decodeBody(res: Response): Promise<string> {
    const charset = res.headers.get("content-type")?.match(/charset=["']?([\w-]+)/i)?.[1];
    const bytes = await res.arrayBuffer();
    try {
        return new TextDecoder(charset ?? "utf-8").decode(bytes);
    } catch {
        return new TextDecoder().decode(bytes); // charset desconocido
    }
}
