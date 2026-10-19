import { CookieJar } from "tough-cookie";
import type { Campus } from "../../shared/campus.js";
import type { Credentials } from "../../shared/credentials.js";
import type { SessionStore } from "../../shared/store/session-store.js";
import { getOwnUser } from "./moodle.js";
import type { AulaSession } from "./session.js";
import { fetchToken } from "./token-login.js";
import { AULA_PLATFORM, type StoredAulaData } from "./hosted-session.js";

export interface LinkedAccount {
    userId: number;
    campus: string;
    username: string;
    email: string | null;
}

/**
 * Inicia sesión en el aula del campus, da de alta al usuario en el store si hace falta y le deja
 * guardada la sesión (token y cookies del SSO). La contraseña solo pasa por esta función y no queda
 * guardada. La llaman `unimcp login --http` y el login OAuth del modo hosteado.
 */
export async function linkAulaAccount(store: SessionStore, campus: Campus, credentials: Credentials): Promise<LinkedAccount> {
    const site = campus.aula;
    if (!site) throw new Error(`El campus ${campus.id} no tiene aula virtual cargada.`);
    const jar = new CookieJar();
    const token = await fetchToken(site, jar, credentials);

    // Recién emitido: si este token no anda, no hay cómo renovarlo.
    const fresh: AulaSession = {
        site,
        getToken: async () => token,
        refreshToken: async () => {
            throw new Error("El aula rechazó el token recién emitido.");
        },
    };
    const own = await getOwnUser(fresh);
    // Mismo username que guarda `users`, en minúscula, porque se compara contra él al renovar.
    const username = own.username.toLowerCase();

    const userId = await store.findOrCreateUser(campus.id, username, own.email ?? undefined);
    const data: StoredAulaData = { username, token, cookies: await jar.serialize() };
    await store.saveSession(userId, AULA_PLATFORM, JSON.stringify(data));
    return { userId, campus: campus.id, username, email: own.email };
}
