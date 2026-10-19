import type { Campus } from "../shared/campus.js";
import { credentialEnvVars, saveCredentials } from "../shared/credentials.js";
import { ask, askHidden } from "../shared/input.js";
import { logger } from "../shared/logger.js";
import { LocalGuaraniSession } from "./client/local-session.js";

/**
 * Guaraní en `mcp-uni-arg login`: su usuario suele ser el DNI, distinto del del aula. Comprueba que
 * entra y guarda las credenciales en el keychain: sin ellas no hay cómo renovar la sesión, que vence
 * en minutos.
 */
export async function loginGuarani(campus: Campus): Promise<void> {
    const site = campus.guarani!;
    const username = (await ask(`Usuario de SIU Guaraní (${new URL(site.baseUrl).host}, suele ser el DNI): `)).trim();
    if (!username) throw new Error("Falta el usuario.");
    const password = await askHidden("Contraseña: ");
    const credentials = { username, password };

    await new LocalGuaraniSession(site).login(credentials);

    if (await saveCredentials("guarani", credentials)) {
        logger.info("SIU Guaraní: credenciales guardadas en el keychain del sistema.");
    } else {
        logger.warn(`No hay keychain disponible: para renovar sin intervención definí ${credentialEnvVars("guarani")}.`);
    }
}
