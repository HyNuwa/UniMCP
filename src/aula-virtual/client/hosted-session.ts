import { CookieJar, type SerializedCookieJar } from "tough-cookie";
import type { AulaSite } from "../../shared/campus.js";
import { loadCredentials } from "../../shared/credentials.js";
import type { SessionStore } from "../../shared/store/session-store.js";
import type { AulaSession } from "./session.js";
import { fetchToken, LoginRequiredError } from "./token-login.js";

/** Clave de la plataforma aula dentro del store. */
export const AULA_PLATFORM = "aula";

/** Datos del aula que el store guarda por usuario. */
export interface StoredAulaData {
    username: string;
    token: string;
    cookies: SerializedCookieJar;
}

/**
 * Sesión de un usuario del store, la que usa el modo HTTP. Para renovar el token prueba primero las
 * cookies del SSO; si vencieron, usa la contraseña del keychain, pero solo si pertenece a este mismo
 * usuario. Eso ocurre únicamente en local: hosteado no hay contraseñas guardadas.
 */
export class StoredAulaSession implements AulaSession {
    private refreshing: Promise<string> | null = null;

    /** `loginUrl`: la página del servidor para volver a iniciar sesión, cuando existe. */
    constructor(
        readonly site: AulaSite,
        private readonly store: SessionStore,
        private readonly userId: number,
        private readonly loginUrl?: string,
    ) {}

    async getToken(): Promise<string> {
        return (await this.read()).token;
    }

    refreshToken(): Promise<string> {
        this.refreshing ??= this.renew().finally(() => {
            this.refreshing = null;
        });
        return this.refreshing;
    }

    private async renew(): Promise<string> {
        const stored = await this.read();
        const jar = await CookieJar.deserialize(stored.cookies);
        // El keychain (o UNI_USER/UNI_PASS) tiene las credenciales de una única persona. Usarlas para
        // otro usuario nos metería en el aula equivocada y dejaría ese token en la sesión ajena.
        const credentials = await loadCredentials("aula");
        const own = credentials?.username.trim().toLowerCase() === stored.username ? credentials : null;

        let token: string;
        try {
            token = await fetchToken(this.site, jar, own);
        } catch (e) {
            if (e instanceof LoginRequiredError) {
                throw this.loginRequired("La sesión del aula venció.");
            }
            throw e;
        }
        const data: StoredAulaData = { ...stored, token, cookies: await jar.serialize() };
        await this.store.saveSession(this.userId, AULA_PLATFORM, JSON.stringify(data));
        return token;
    }

    private async read(): Promise<StoredAulaData> {
        const raw = await this.store.loadSession(this.userId, AULA_PLATFORM);
        if (!raw) throw this.loginRequired("No hay sesión del aula para este usuario.");
        return JSON.parse(raw) as StoredAulaData;
    }

    /** En modo hosteado se vuelve a entrar desde la página del servidor; si no hay, desde el CLI. */
    private loginRequired(reason: string): LoginRequiredError {
        const next = this.loginUrl
            ? `Pedile al usuario que vuelva a iniciar sesión en ${this.loginUrl} y después reintentá.`
            : "Volvé a iniciar sesión con `unimcp login --http` en la máquina del servidor.";
        return new LoginRequiredError(`${reason} ${next}`);
    }
}
