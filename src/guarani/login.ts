import type { Campus } from "../shared/campus.js";
import { credentialEnvVars, saveCredentials } from "../shared/credentials.js";
import { logger } from "../shared/logger.js";
import { askCredentials } from "../shared/login-retry.js";
import { LocalGuaraniSession } from "./client/local-session.js";

/**
 * Guaraní en `unimcp login`: su usuario suele ser el DNI, distinto del del aula. Comprueba que
 * entra y guarda las credenciales en el keychain: sin ellas no hay cómo renovar la sesión, que vence
 * en minutos.
 */
export async function loginGuarani(campus: Campus): Promise<void> {
    const site = campus.guarani!;
    // Una contraseña mal se vuelve a pedir, en vez de cortar y tener que correr login de nuevo.
    const { credentials } = await askCredentials(`Usuario de SIU Guaraní (${new URL(site.baseUrl).host}, suele ser el DNI): `, (c) =>
        new LocalGuaraniSession(site).login(c),
    );

    if (await saveCredentials("guarani", credentials)) {
        logger.info("SIU Guaraní: credenciales guardadas en el keychain del sistema.");
    } else {
        logger.warn(`No hay keychain disponible: para renovar sin intervención definí ${credentialEnvVars("guarani")}.`);
    }
}
