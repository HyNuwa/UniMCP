import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Confirmación en dos pasos de una escritura: la primera llamada muestra lo que se va a hacer y devuelve
 * un código; la segunda lo trae y escribe. No prueba que el usuario vio la vista previa (el modelo
 * recibe el código y lo puede usar solo), pero obliga a que lo que se va a hacer quede a la vista antes
 * de hacerlo. La aprobación de una persona la pone el cliente MCP, y el límite que un prompt injection
 * no cruza es `UNIMCP_WRITE_TOOLS`.
 *
 * El código es una firma de la `huella` de la escritura, que incluye el estado actual de lo que se va a
 * cambiar: cuando la escritura se hace, ese estado cambia y el código deja de servir, sin guardar nada.
 * Así funciona en HTTP, donde cada pedido llega con una sesión nueva.
 */

/** Vida de un código, en milisegundos: lo que tarda el usuario en leer la vista previa y contestar. */
export const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

/** Clave de este proceso: con un reinicio, los códigos anteriores dejan de valer y se pide otra vista previa. */
const SECRET = randomBytes(32);

/** Resumen de todo lo que define una escritura: quién, dónde, qué y en qué estado estaba. */
export const fingerprint = (parts: unknown) => createHash("sha256").update(JSON.stringify(parts)).digest("base64url");

const sign = (expiresAt: number, print: string) =>
    createHmac("sha256", SECRET).update(`${expiresAt}.${print}`).digest("base64url");

export function issueConfirmation(print: string, now = Date.now()): string {
    const expiresAt = now + CONFIRMATION_TTL_MS;
    return `${expiresAt}.${sign(expiresAt, print)}`;
}

/** Por qué no vale un código, o undefined si vale para esta huella. */
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
    return undefined;
}
