import type { CookieJar } from "tough-cookie";
import type { GuaraniSite } from "../../shared/campus.js";

/**
 * La sesión de Guaraní de un usuario. Guaraní no tiene API ni token: es la cookie de sesión de la
 * autogestión, que vence en minutos, así que renovarla es volver a entrar con usuario y contraseña.
 */
export interface GuaraniSession {
    readonly site: GuaraniSite;
    /** Las cookies guardadas; si no hay, entra. Pueden haber vencido: Guaraní lo dice mostrando el login. */
    getJar(): Promise<CookieJar>;
    /** Vuelve a entrar y devuelve las cookies nuevas. */
    renew(): Promise<CookieJar>;
    /** Guarda las cookies después de un request: Guaraní las rota. */
    save(jar: CookieJar): Promise<void>;
}
