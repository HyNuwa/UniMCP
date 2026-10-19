import { logger } from "./logger.js";

export interface Credentials {
    username: string;
    password: string;
}

/**
 * Cada plataforma usa su propio usuario: en el aula suele ser el institucional y en Guaraní, el DNI.
 */
export type CredentialAccount = "aula" | "guarani";

const SERVICE = "unimcp";

/** Cuenta del keychain y variables de entorno que corresponden a cada plataforma. */
const ACCOUNTS: Record<CredentialAccount, { keychain: string; user: string; pass: string }> = {
    aula: { keychain: "aula-virtual", user: "UNI_USER", pass: "UNI_PASS" },
    guarani: { keychain: "guarani", user: "UNI_GUARANI_USER", pass: "UNI_GUARANI_PASS" },
};

// Import dinámico: si falta el binario nativo o el Secret Service (Linux), se sigue con las variables
// de entorno.
async function entry(account: CredentialAccount) {
    const { Entry } = await import("@napi-rs/keyring");
    return new Entry(SERVICE, ACCOUNTS[account].keychain);
}

/**
 * Prioriza las variables de entorno de la plataforma (UNI_USER/UNI_PASS en el aula); si no están, lee
 * el keychain.
 */
export async function loadCredentials(account: CredentialAccount): Promise<Credentials | null> {
    const { user, pass } = ACCOUNTS[account];
    const username = process.env[user];
    const password = process.env[pass];
    if (username && password) return { username, password };

    try {
        const raw = (await entry(account)).getPassword();
        return raw ? (JSON.parse(raw) as Credentials) : null;
    } catch (e) {
        logger.warn("Keychain no disponible:", (e as Error).message);
        return null;
    }
}

/**
 * Guarda en el keychain; devuelve false si no hay uno disponible (como en Linux sin Secret Service).
 */
export async function saveCredentials(account: CredentialAccount, creds: Credentials): Promise<boolean> {
    try {
        (await entry(account)).setPassword(JSON.stringify(creds));
        return true;
    } catch (e) {
        logger.warn("No se pudo guardar en el keychain:", (e as Error).message);
        return false;
    }
}

/** Variables de entorno que sustituyen al keychain, para nombrarlas en los errores. */
export const credentialEnvVars = (account: CredentialAccount) => `${ACCOUNTS[account].user} y ${ACCOUNTS[account].pass}`;
