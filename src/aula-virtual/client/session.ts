import type { AulaSite } from "../../shared/campus.js";

/**
 * El aula de un usuario junto con su token. Quien habla con el aula recibe este objeto sin importarle
 * el origen: `LocalSession` (STDIO, el dueño de la compu) o `StoredAulaSession` (HTTP, un usuario del
 * store).
 */
export interface AulaSession {
    /** Moodle del campus del usuario; cada uno puede tener el suyo. */
    readonly site: AulaSite;
    /** Devuelve el token actual o consigue uno si no hay. */
    getToken(): Promise<string>;
    /** Tira el token actual y consigue otro. */
    refreshToken(): Promise<string>;
}
