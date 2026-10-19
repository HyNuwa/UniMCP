import { homedir } from "node:os";
import { join } from "node:path";

/** Carpeta de configuración: UNIMCP_HOME, o %APPDATA% en Windows, o XDG/~/.config en Linux y macOS. */
export function configDir(): string {
    if (process.env.UNIMCP_HOME) return process.env.UNIMCP_HOME;
    if (process.platform === "win32") {
        return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "unimcp");
    }
    return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "unimcp");
}

/** Campus elegido en `unimcp login`, que usa el modo local. */
export const campusFile = () => join(configDir(), "campus.json");

/** Token de Moodle y cookies del SSO del modo local. */
export const sessionFile = () => join(configDir(), "session.json");

/** Cookies de la sesión de SIU Guaraní del modo local. */
export const guaraniSessionFile = () => join(configDir(), "guarani-session.json");

/**
 * Base del modo HTTP con usuarios, tokens y sesiones: UNIMCP_DB o un SQLite en la carpeta de
 * configuración.
 */
export const storeFile = () => process.env.UNIMCP_DB ?? join(configDir(), "unimcp.db");

/** Clave para cifrar las sesiones de la base cuando no llega por UNIMCP_KEY. */
export const storeKeyFile = () => join(configDir(), "store.key");
