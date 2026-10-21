import { randomInt } from "node:crypto";
import type { CookieJar } from "tough-cookie";
import type { AulaSite } from "../../shared/campus.js";
import { loginHint, type Credentials } from "../../shared/credentials.js";
import { MoodleError } from "./web-service.js";

export class LoginRequiredError extends Error {
    constructor(message = `Hace falta iniciar sesión en el aula. ${loginHint()}`) {
        super(message);
        this.name = "LoginRequiredError";
    }
}

export class InvalidCredentialsError extends Error {
    constructor(reason?: string) {
        const base = `El aula rechazó usuario o contraseña. ${loginHint()}`;
        super(reason ? `${base} Motivo del aula: ${reason}` : base);
        this.name = "InvalidCredentialsError";
    }
}

const MAX_REDIRECTS = 20;
const TIMEOUT_MS = 30_000;

type Landing = { token: string } | { url: string; html: string };

/**
 * Consigue un token del web service. El camino depende del campus:
 * - Con SSO (Keycloak, como UTN FRBA o Exactas UBA): el flujo de launch.php, que aprovecha la sesión
 * del SSO.
 * - Con login propio de Moodle (como UNJu): primero `login/token.php`, que funciona aunque el plugin de
 * mobile launch esté apagado; si no, launch.php.
 * Las cookies se guardan en `jar`, así el token se renueva sin contraseña mientras sigan vigentes.
 */
export async function fetchToken(site: AulaSite, jar: CookieJar, credentials: Credentials | null): Promise<string> {
    const { baseUrl, ssoHost } = site;
    // Login propio de Moodle: primero token.php, que no necesita launch.php.
    if (!ssoHost) {
        if (!credentials) throw new LoginRequiredError();
        const viaTokenPhp = await tryTokenPhp(baseUrl, credentials);
        if (viaTokenPhp) return viaTokenPhp;
    }

    const launchUrl =
        `${baseUrl}/admin/tool/mobile/launch.php` +
        `?service=moodle_mobile_app&passport=${randomInt(1e9)}&urlscheme=moodlemobile`;

    let landing = await follow(jar, launchUrl);
    if ("token" in landing) return landing.token;

    const oauthUrl = landing.html.match(/href="([^"]*\/auth\/oauth2\/login\.php[^"]*)"/)?.[1];
    if (oauthUrl) {
        landing = await follow(jar, decodeHtml(oauthUrl));
        if ("token" in landing) return landing.token;

        if (ssoHost && new URL(landing.url).host === ssoHost) {
            if (!credentials) throw new LoginRequiredError();
            landing = await submitSsoForm(jar, landing.html, credentials);
            if ("token" in landing) return landing.token;
            if (new URL(landing.url).host === ssoHost) throw new InvalidCredentialsError(extractLoginError(landing.html));
        }
    } else {
        if (!credentials) throw new LoginRequiredError();
        const loginPageUrl = `${baseUrl}/login/index.php`;
        const loginPage = await follow(jar, loginPageUrl);
        if ("token" in loginPage) return loginPage.token;
        landing = await submitMoodleLoginForm(jar, loginPage.url, loginPage.html, credentials);
        if ("token" in landing) return landing.token;
        const stillOnLogin =
            landing.url.includes("/login") ||
            /alert-danger/i.test(landing.html) ||
            /loginerrors/i.test(landing.html);
        if (stillOnLogin) {
            const reason = extractLoginError(landing.html);
            throw new InvalidCredentialsError(reason);
        }
    }

    landing = await follow(jar, launchUrl);
    if ("token" in landing) return landing.token;

    if (!ssoHost && credentials) {
        const viaTokenPhp = await tryTokenPhp(baseUrl, credentials);
        if (viaTokenPhp) return viaTokenPhp;
    }

    throw unexpected(landing.url);
}

/**
 * Pide el token a /login/token.php, el endpoint estándar de Moodle. Si el aula no lo ofrece (no
 * contesta JSON) devuelve null y se sigue con launch.php; si contesta un error, lo lanza.
 */
async function tryTokenPhp(baseUrl: string, credentials: Credentials): Promise<string | null> {
    const res = await fetch(`${baseUrl}/login/token.php`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            username: credentials.username,
            password: credentials.password,
            service: "moodle_mobile_app",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let data: { token?: string; error?: string; errorcode?: string };
    try {
        data = await res.json();
    } catch {
        return null;
    }
    if (data.token) return data.token;
    if (data.errorcode === "invalidlogin" || /invalid login/i.test(data.error ?? "")) {
        throw new InvalidCredentialsError(data.error);
    }
    // launch.php usa el mismo servicio: si token.php lo rechazó, no tiene sentido seguir.
    throw new MoodleError(
        `El aula no dio el token (${data.errorcode ?? res.status}): ${data.error ?? "respuesta sin token"}. ` +
            "Si dice que el servicio web no está disponible, lo tiene que habilitar el admin del aula.",
        data.errorcode,
    );
}

/**
 * Envía usuario y contraseña al formulario de Keycloak. En el tema nuevo la acción viene en un JSON
 * (`"loginAction"`); en el clásico, en el `action` de `#kc-form-login` (como en Exactas UBA).
 */
async function submitSsoForm(jar: CookieJar, html: string, { username, password }: Credentials): Promise<Landing> {
    const fromJson = html.match(/"loginAction"\s*:\s*("(?:[^"\\]|\\.)*")/)?.[1];
    const fromForm = html.match(/<form[^>]*id="kc-form-login"[^>]*action="([^"]*)"/i)?.[1];
    const action = fromJson ? (JSON.parse(fromJson) as string) : fromForm ? decodeHtml(fromForm) : null;
    if (!action) throw new Error("No se encontró el formulario del SSO; puede que haya cambiado.");

    const body = new URLSearchParams({ username, password, rememberMe: "on", credentialId: "" });
    return follow(jar, action, { method: "POST", body });
}

/** Login propio de Moodle, sin SSO: completa el formulario de /login/index.php. */
async function submitMoodleLoginForm(
    jar: CookieJar,
    pageUrl: string,
    html: string,
    { username, password }: Credentials,
): Promise<Landing> {
    const tokenMatch =
        html.match(/name="logintoken"\s+value="([^"]*)"/) ||
        html.match(/value="([^"]*)"\s+name="logintoken"/);
    const logintoken = tokenMatch?.[1] ?? "";

    const actionMatch = html.match(/<form[^>]*action="([^"]*)"[^>]*>/i);
    let action = actionMatch?.[1] ? decodeHtml(actionMatch[1]) : "";
    if (!action) action = pageUrl;
    if (!action.startsWith("http")) action = new URL(action, pageUrl).toString();

    const body = new URLSearchParams({ username, password, logintoken, anchor: "" });
    return follow(jar, action, { method: "POST", body });
}

/** Hace la request siguiendo los redirects a mano, para guardar las cookies de cada salto. */
async function follow(jar: CookieJar, url: string, init?: RequestInit): Promise<Landing> {
    for (let i = 0; i < MAX_REDIRECTS; i++) {
        const cookie = await jar.getCookieString(url);
        const res = await fetch(url, {
            ...init,
            redirect: "manual",
            headers: cookie ? { cookie } : {},
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        for (const setCookie of res.headers.getSetCookie()) {
            await jar.setCookie(setCookie, url, { ignoreError: true });
        }

        const location = res.headers.get("location");
        if (res.status >= 300 && res.status < 400 && location) {
            await res.body?.cancel();
            if (location.startsWith("moodlemobile://")) return { token: decodeLaunchToken(location) };
            url = new URL(location, url).toString();
            init = undefined; // después de un redirect se sigue con GET
            continue;
        }
        return { url, html: await res.text() };
    }
    throw new Error("Demasiadas redirecciones en el login.");
}

/** moodlemobile://token=BASE64(siteid:::token[:::privatetoken]) → token */
export function decodeLaunchToken(url: string): string {
    const encoded = decodeURIComponent(url.split("token=")[1] ?? "");
    const parts = Buffer.from(encoded, "base64").toString("utf8").split(":::");
    if (parts.length < 2 || !parts[1]) throw new Error("Formato de token inesperado en launch.php");
    return parts[1];
}

const decodeHtml = (s: string) => s.replaceAll("&amp;", "&");

/** Saca el mensaje de error que la página de login de Moodle o Keycloak le muestra al usuario. */
function extractLoginError(html: string): string | undefined {
    const patterns = [
        /alert-danger[^>]*>([\s\S]*?)<\/div>/i,
        /alert-error[^>]*>([\s\S]*?)<\/div>/i,
        /class="[^"]*error[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*id="loginerrormessage"[^>]*>([\s\S]*?)<\/div>/i,
        // Keycloak, tema clásico.
        /<span[^>]*id="input-error"[^>]*>([\s\S]*?)<\/span>/i,
        /<span[^>]*class="kc-feedback-text"[^>]*>([\s\S]*?)<\/span>/i,
    ];
    for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) {
            const text = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            if (text) return text;
        }
    }
    return undefined;
}

const unexpected = (url: string) => {
    const { host, pathname } = new URL(url);
    return new Error(`Flujo de login inesperado: terminó en ${host}${pathname}`);
};
