import type { CookieJar } from "tough-cookie";
import type { GuaraniSite } from "../../shared/campus.js";
import type { Credentials } from "../../shared/credentials.js";
import { fetchWithCookies } from "../../shared/http.js";
import type { GuaraniSession } from "./session.js";
import type { G3wPage, Pagelet } from "./types.js";

export class GuaraniLoginRequiredError extends Error {
    constructor(message = "Hace falta iniciar sesión en SIU Guaraní: corré `mcp-uni-arg login`.") {
        super(message);
        this.name = "GuaraniLoginRequiredError";
    }
}

export class InvalidGuaraniCredentialsError extends Error {
    constructor(reason?: string) {
        const base = "Guaraní rechazó usuario o contraseña. Corré `mcp-uni-arg login` para actualizarlos.";
        super(reason ? `${base} Motivo de Guaraní: ${reason}` : base);
        this.name = "InvalidGuaraniCredentialsError";
    }
}

/** Las operaciones de `acceso` son el login y el logout: el modelo no tiene nada que hacer ahí. */
const ACCESS_OP = /^acceso(\/|$|\?)/;

/**
 * Entra a la autogestión con el formulario de login (`acceso?auth=form`). Primero se pide la página
 * de acceso para tener la cookie de sesión y la `action` exacta del formulario, que cambia entre
 * instalaciones (con o sin `:443`).
 */
export async function login(site: GuaraniSite, jar: CookieJar, { username, password }: Credentials): Promise<void> {
    const access = await fetchWithCookies(jar, `${site.baseUrl}/acceso`);
    const formPagelet = parsePagelets(access.html).find(isLoginForm);
    const action = formPagelet?.content.match(/<form[^>]*action="([^"]*)"[^>]*id="guarani_form_login"/)?.[1];

    const body = new URLSearchParams({ usuario: username, password, login: "Ingresar" });
    const landing = await fetchWithCookies(jar, action ? decodeHtml(action) : `${site.baseUrl}/acceso?auth=form`, {
        method: "POST",
        body,
    });
    const pagelets = parsePagelets(landing.html);
    const failed = pagelets.find(isLoginForm);
    if (failed) throw new InvalidGuaraniCredentialsError(loginError(failed.content));
}

/**
 * Abre una página de la autogestión con la sesión del usuario. Si Guaraní muestra el login es porque
 * la sesión venció: entra de nuevo una sola vez y repite.
 */
export async function getPage(session: GuaraniSession, address: string): Promise<G3wPage> {
    const url = pageUrl(session.site, address);
    let jar = await session.getJar();

    for (let attempt = 0; ; attempt++) {
        const res = await fetchWithCookies(jar, url.href);
        const pagelets = parsePagelets(res.html);
        if (pagelets.some(isLoginForm)) {
            if (attempt === 0) {
                jar = await session.renew();
                continue;
            }
            throw new GuaraniLoginRequiredError("Guaraní volvió al login aun después de entrar de nuevo.");
        }
        await session.save(jar);
        if (res.status >= 400) throw new Error(`Guaraní contestó HTTP ${res.status} en ${new URL(res.url).pathname}.`);
        return { url: res.url, op: pagelets[0]?.op ?? null, pagelets };
    }
}

/**
 * La URL de una dirección del modelo: una ruta relativa a la autogestión (`historia_academica`) o una
 * URL completa de la misma. Cualquier otra cosa se rechaza, porque con el request viajan las cookies
 * de la sesión del usuario.
 */
export function pageUrl(site: GuaraniSite, address: string): URL {
    const base = new URL(`${site.baseUrl}/`);
    let u: URL;
    try {
        u = /^https?:\/\//i.test(address) ? new URL(address) : new URL(address.trim().replace(/^\/+/, ""), base);
    } catch {
        throw new Error(`Dirección inválida: "${address}". Usá una \`direccion\` tal como la devuelve guarani_menu.`);
    }
    // `new URL` saca el `:443` que ponen algunos links de Guaraní, así que se comparan bien.
    if (u.origin !== base.origin || !u.pathname.startsWith(base.pathname)) {
        throw new Error(`Solo se pueden abrir páginas de la autogestión (${base.href}...).`);
    }
    if (ACCESS_OP.test(toAddress(site, u))) {
        throw new Error("Las páginas de acceso (login y logout) no se abren: la sesión la maneja el servidor.");
    }
    u.hash = "";
    return u;
}

/** Lo inverso de pageUrl: la ruta relativa, que es lo que ve el modelo. */
export function toAddress(site: GuaraniSite, url: URL | string): string {
    const u = new URL(url);
    const base = new URL(`${site.baseUrl}/`);
    return u.pathname.slice(base.pathname.length) + u.search;
}

/**
 * G3W no manda la página armada: cada parte (pagelet) llega como `kernel.renderer.on_arrival({...})`,
 * un JSON con la operación, el id de la parte y su HTML. Las barras van escapadas (`<\/script>`),
 * así que el primer `);</script>` cierra el JSON.
 */
export function parsePagelets(html: string): Pagelet[] {
    const pagelets: Pagelet[] = [];
    for (const chunk of html.split("kernel.renderer.on_arrival(").slice(1)) {
        const end = chunk.indexOf(");</script>");
        if (end < 0) continue;
        try {
            const data = JSON.parse(chunk.slice(0, end)) as { op?: string; info?: { id?: string }; content?: string };
            pagelets.push({ op: data.op ?? "", id: data.info?.id ?? "", content: data.content ?? "" });
        } catch {
            // Una parte que no es JSON válido no frena al resto.
        }
    }
    return pagelets;
}

const isLoginForm = (p: Pagelet) => p.content.includes('id="guarani_form_login"');

/** El aviso de `#error_login` ("El nombre de usuario y/o contraseña es incorrecto"). */
function loginError(html: string): string | undefined {
    const m = html.match(/id="error_login"[^>]*>([\s\S]*?)<\/div>/i);
    const text = m?.[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return text || undefined;
}

const decodeHtml = (s: string) => s.replaceAll("&amp;", "&");
