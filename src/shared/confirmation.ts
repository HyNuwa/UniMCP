import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Confirmación en dos pasos de una escritura: la primera llamada muestra lo que se va a hacer y devuelve
 * un código; la segunda lo trae y escribe. No prueba que el usuario vio la vista previa (el modelo
 * recibe el código y lo puede usar solo), pero obliga a que lo que se va a hacer quede a la vista antes
 * de hacerlo. La aprobación de una persona la pone el cliente MCP, y el límite que un prompt injection
 * no cruza es `UNIMCP_WRITE_TOOLS`.
 *
 * El código es una firma de la `huella` de la escritura (quién, qué y, si se puede, el estado actual de
 * lo que se va a cambiar), así que no sirve para otra cosa que lo que mostró la vista previa. Además se
 * usa una sola vez: un mensaje no deja un estado que cambie al mandarlo. Los usados se recuerdan en el
 * proceso hasta que vencen, no en la sesión, porque en HTTP cada pedido llega con una sesión nueva.
 */

/** Vida de un código, en milisegundos: lo que tarda el usuario en leer la vista previa y contestar. */
export const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

/** Clave de este proceso: con un reinicio, los códigos anteriores dejan de valer y se pide otra vista previa. */
const SECRET = randomBytes(32);

/** Resumen de todo lo que define una escritura: quién, dónde, qué y en qué estado estaba. */
export const fingerprint = (parts: unknown) => createHash("sha256").update(JSON.stringify(parts)).digest("base64url");

/** Códigos ya usados, con su vencimiento: después de vencer no hace falta recordarlos. */
const redeemed = new Map<string, number>();

const sign = (expiresAt: number, print: string) =>
    createHmac("sha256", SECRET).update(`${expiresAt}.${print}`).digest("base64url");

export function issueConfirmation(print: string, now = Date.now()): string {
    const expiresAt = now + CONFIRMATION_TTL_MS;
    return `${expiresAt}.${sign(expiresAt, print)}`;
}

/** Por qué no vale un código, o undefined si vale para esta huella; uno que vale queda usado. */
export function confirmationProblem(code: string, print: string, now = Date.now()): string | undefined {
    const [rawExpiry, mac, ...rest] = code.trim().split(".");
    const expiresAt = Number(rawExpiry);
    if (rest.length || !mac || !Number.isSafeInteger(expiresAt)) {
        return "El código de `confirmacion` no es válido: copialo tal cual de la vista previa.";
    }
    const expected = Buffer.from(sign(expiresAt, print));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        return (
            "Lo que se pide no es lo de la vista previa, o cambió desde entonces (o ya se hizo). Llamá de " +
            "nuevo sin `confirmacion` para ver la vista previa actual y mostrásela al usuario."
        );
    }
    if (expiresAt < now) {
        return "El código de `confirmacion` venció. Llamá de nuevo sin `confirmacion` para ver la vista previa actual.";
    }
    for (const [used, until] of redeemed) if (until < now) redeemed.delete(used);
    if (redeemed.has(mac)) {
        return "Ese código ya se usó: lo de la vista previa ya se hizo. Para hacerlo otra vez, pedí una vista previa nueva.";
    }
    redeemed.set(mac, expiresAt);
    return undefined;
}
