import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CookieJar, type SerializedCookieJar } from "tough-cookie";
import type { AulaSite } from "../../shared/campus.js";
import { loadCredentials, type Credentials } from "../../shared/credentials.js";
import { sessionFile } from "../../shared/paths.js";
import { logger } from "../../shared/logger.js";
import type { AulaSession } from "./session.js";
import { fetchToken } from "./token-login.js";

interface StoredSession {
    /** Base URL del Moodle que emitió el token; si el login cambió de campus, se descarta. */
    baseUrl?: string;
    token: string | null;
    obtainedAt: string | null;
    cookies: SerializedCookieJar | null;
}

/**
 * Sesión local de un único usuario, persistida en disco.
 * Las credenciales van al keychain (o UNI_USER/UNI_PASS); el token y las cookies del SSO, a
 * session.json.
 */
export class LocalSession implements AulaSession {
    private refreshing: Promise<string> | null = null;

    constructor(readonly site: AulaSite) {}

    async getToken(): Promise<string> {
        const stored = await this.read();
        return (stored.baseUrl === this.site.baseUrl && stored.token) || this.refreshToken();
    }

    /** Si varias tools fallan juntas, comparten una sola renovación. */
    refreshToken(): Promise<string> {
        this.refreshing ??= loadCredentials("aula")
            .then((creds) => this.login(creds))
            .finally(() => {
                this.refreshing = null;
            });
        return this.refreshing;
    }

    /** Pide un token nuevo y lo persiste con las cookies del SSO. */
    async login(credentials: Credentials | null): Promise<string> {
        logger.info("Obteniendo token del aula virtual...");
        const stored = await this.read();
        const sameSite = stored.baseUrl === this.site.baseUrl && stored.cookies;
        const jar = sameSite ? await CookieJar.deserialize(stored.cookies!) : new CookieJar();

        const token = await fetchToken(this.site, jar, credentials);
        await this.write({ baseUrl: this.site.baseUrl, token, obtainedAt: new Date().toISOString(), cookies: await jar.serialize() });
        return token;
    }

    private async read(): Promise<StoredSession> {
        try {
            return JSON.parse(await readFile(sessionFile(), "utf8")) as StoredSession;
        } catch {
            return { token: null, obtainedAt: null, cookies: null };
        }
    }

    private async write(data: StoredSession): Promise<void> {
        const file = sessionFile();
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(data, null, 2), { mode: 0o600 });
        await chmod(file, 0o600).catch(() => {}); // en Windows no hace nada
    }
}
