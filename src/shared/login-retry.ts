import { RejectedCredentialsError, type Credentials } from "./credentials.js";
import { ask, askHidden } from "./input.js";
import { logger } from "./logger.js";

/** Intentos de usuario y contraseña en `unimcp login`: más, y el aula o Guaraní pueden bloquear la cuenta. */
export const MAX_LOGIN_ATTEMPTS = 3;

/**
 * Pide usuario y contraseña y prueba el login; si la plataforma los rechaza, los vuelve a pedir en vez
 * de cortar `unimcp login`, hasta MAX_LOGIN_ATTEMPTS. Cualquier otro error (la red, un SSO que cambió)
 * corta enseguida.
 */
export async function askCredentials<T>(
    userQuestion: string,
    login: (credentials: Credentials) => Promise<T>,
    io: { ask: (q: string) => Promise<string>; askHidden: (q: string) => Promise<string> } = { ask, askHidden },
): Promise<{ credentials: Credentials; result: T }> {
    for (let attempt = 1; ; attempt++) {
        const username = (await io.ask(userQuestion)).trim();
        if (!username) throw new Error("Falta el usuario.");
        const credentials = { username, password: await io.askHidden("Contraseña: ") };
        try {
            return { credentials, result: await login(credentials) };
        } catch (e) {
            if (!(e instanceof RejectedCredentialsError) || attempt >= MAX_LOGIN_ATTEMPTS) throw e;
            const reason = e.reason ? ` (${e.reason})` : "";
            logger.warn(`${e.rejected} rechazó el usuario o la contraseña${reason}. Probá de nuevo (intento ${attempt + 1} de ${MAX_LOGIN_ATTEMPTS}).`);
        }
    }
}
