import { homedir } from "node:os";
import { join } from "node:path";

/** Carpeta de configuración: MCP_UNI_HOME, o %APPDATA% en Windows, o XDG/~/.config en Linux y macOS. */
export function configDir(): string {
    if (process.env.MCP_UNI_HOME) return process.env.MCP_UNI_HOME;
    if (process.platform === "win32") {
        return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "mcp-uni-arg");
    }
    return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "mcp-uni-arg");
}

/** Campus elegido en `mcp-uni-arg login`, que usa el modo local. */
export const campusFile = () => join(configDir(), "campus.json");

/** Token de Moodle y cookies del SSO del modo local. */
export const sessionFile = () => join(configDir(), "session.json");

/** Cookies de la sesión de SIU Guaraní del modo local. */
export const guaraniSessionFile = () => join(configDir(), "guarani-session.json");

/**
 * Base del modo HTTP con usuarios, tokens y sesiones: MCP_UNI_DB o un SQLite en la carpeta de
 * configuración.
 */
export const storeFile = () => process.env.MCP_UNI_DB ?? join(configDir(), "mcp-uni-arg.db");

/** Clave para cifrar las sesiones de la base cuando no llega por MCP_UNI_KEY. */
export const storeKeyFile = () => join(configDir(), "store.key");
