import type { CookieJar } from "tough-cookie";

export class HttpError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
        this.name = "HttpError";
    }
}

/** POST application/x-www-form-urlencoded con respuesta JSON y timeout. */
export async function postForm<T>(
    url: string,
    params: Record<string, string | number>,
    timeoutMs = 30_000,
): Promise<T> {
    const body = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
    );

    let res: Response;
    try {
        res = await fetch(url, {
            method: "POST",
            body,
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (e) {
        throw new HttpError(`No se pudo conectar con ${new URL(url).host}: ${(e as Error).message}`);
    }

    if (!res.ok) throw new HttpError(`HTTP ${res.status} en ${new URL(url).pathname}`, res.status);

    try {
        return (await res.json()) as T;
    } catch {
        throw new HttpError(`Respuesta no JSON en ${new URL(url).pathname}`, res.status);
    }
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
                headers: cookie ? { cookie } : {},
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
