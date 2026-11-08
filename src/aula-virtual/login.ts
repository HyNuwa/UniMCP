import type { Campus } from "../shared/campus.js";
import { credentialEnvVars, saveCredentials, type Credentials } from "../shared/credentials.js";
import { logger } from "../shared/logger.js";
import { askCredentials } from "../shared/login-retry.js";
import { SqliteStore } from "../shared/store/sqlite-store.js";
import { linkAulaAccount } from "./client/link-account.js";
import { LocalSession } from "./client/local-session.js";

/**
 * Parte del aula en `unimcp login`: pide usuario y contraseña (de nuevo si el aula los rechaza), los deja en el
 * keychain y saca el primer token. De ahí en más el servidor renueva por su cuenta.
 * Con `http`, guarda la sesión en el store y devuelve el token que va a usar el cliente MCP.
 */
export async function loginAula(campus: Campus, http: boolean): Promise<string | null> {
    const site = campus.aula!;
    // Una contraseña mal se vuelve a pedir, en vez de cortar y tener que correr login de nuevo.
    const { credentials, result: accessToken } = await askCredentials(
        `Usuario del aula virtual (${new URL(site.baseUrl).host}): `,
        async (c): Promise<string | null> => {
            if (http) return loginToStore(campus, c);
            await new LocalSession(site).login(c);
            return null;
        },
    );

    // Se guardan solo después de verificar que el aula las aceptó.
    if (await saveCredentials("aula", credentials)) {
        logger.info("Aula virtual: credenciales guardadas en el keychain del sistema.");
    } else {
        logger.warn(`No hay keychain disponible: para renovar sin intervención definí ${credentialEnvVars("aula")}.`);
    }
    return accessToken;
}

/**
 * Da de alta al usuario si no existe, guarda su sesión del aula y le emite un token sin vencimiento.
 */
async function loginToStore(campus: Campus, credentials: Credentials): Promise<string> {
    const store = await SqliteStore.open();
    const { userId } = await linkAulaAccount(store, campus, credentials);
    return store.issueToken(userId, { kind: "access", clientId: "local" });
}
