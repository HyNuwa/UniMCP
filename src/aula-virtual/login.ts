import type { Campus } from "../shared/campus.js";
import { credentialEnvVars, saveCredentials, type Credentials } from "../shared/credentials.js";
import { ask, askHidden } from "../shared/input.js";
import { logger } from "../shared/logger.js";
import { SqliteStore } from "../shared/store/sqlite-store.js";
import { linkAulaAccount } from "./client/link-account.js";
import { LocalSession } from "./client/local-session.js";

/**
 * Parte del aula en `unimcp login`: pide usuario y contraseña una sola vez, los deja en el
 * keychain y saca el primer token. De ahí en más el servidor renueva por su cuenta.
 * Con `http`, guarda la sesión en el store y devuelve el token que va a usar el cliente MCP.
 */
export async function loginAula(campus: Campus, http: boolean): Promise<string | null> {
    const site = campus.aula!;
    const username = (await ask(`Usuario del aula virtual (${new URL(site.baseUrl).host}): `)).trim();
    if (!username) throw new Error("Falta el usuario.");
    const password = await askHidden("Contraseña: ");
    const credentials = { username, password };

    let accessToken: string | null = null;
    if (http) accessToken = await loginToStore(campus, credentials);
    else await new LocalSession(site).login(credentials);

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
