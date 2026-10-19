import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CookieJar, type SerializedCookieJar } from "tough-cookie";
import type { GuaraniSite } from "../../shared/campus.js";
import { loadCredentials, type Credentials } from "../../shared/credentials.js";
import { logger } from "../../shared/logger.js";
import { guaraniSessionFile } from "../../shared/paths.js";
import { GuaraniLoginRequiredError, login } from "./g3w.js";
import type { GuaraniSession } from "./session.js";

interface StoredSession {
    /** La autogestión de las cookies: si se cambió de campus con login, no sirven. */
    baseUrl: string;
    cookies: SerializedCookieJar;
}

/**
 * Sesión de Guaraní del modo local: credenciales en el keychain (o UNI_GUARANI_USER/UNI_GUARANI_PASS)
 * y cookies en guarani-session.json.
 */
export class LocalGuaraniSession implements GuaraniSession {
    private renewing: Promise<CookieJar> | null = null;

    constructor(readonly site: GuaraniSite) {}

    async getJar(): Promise<CookieJar> {
        const stored = await this.read();
        if (stored?.baseUrl === this.site.baseUrl) return CookieJar.deserialize(stored.cookies);
        return this.renew();
    }

    /** Una sola entrada en curso aunque varias tools encuentren la sesión vencida a la vez. */
    renew(): Promise<CookieJar> {
        this.renewing ??= loadCredentials("guarani")
            .then((creds) => this.login(creds))
            .finally(() => {
                this.renewing = null;
            });
        return this.renewing;
    }

    /** Entra con usuario y contraseña y guarda las cookies. */
    async login(credentials: Credentials | null): Promise<CookieJar> {
        if (!credentials) throw new GuaraniLoginRequiredError();
        logger.info("Entrando a SIU Guaraní...");
        const jar = new CookieJar();
        await login(this.site, jar, credentials);
        await this.save(jar);
        return jar;
    }

    async save(jar: CookieJar): Promise<void> {
        const file = guaraniSessionFile();
        const data: StoredSession = { baseUrl: this.site.baseUrl, cookies: await jar.serialize() };
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(data, null, 2), { mode: 0o600 });
        await chmod(file, 0o600).catch(() => {}); // no-op en Windows
    }

    private async read(): Promise<StoredSession | null> {
        try {
            return JSON.parse(await readFile(guaraniSessionFile(), "utf8")) as StoredSession;
        } catch {
            return null;
        }
    }
}
