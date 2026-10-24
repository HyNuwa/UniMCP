// stderr, porque en STDIO stdout es el canal del protocolo.
export const logger = {
    info: (...args: unknown[]) => console.error("[unimcp]", ...args),
    warn: (...args: unknown[]) => console.error("[unimcp] WARN", ...args),
    error: (...args: unknown[]) => console.error("[unimcp] ERROR", ...args),
};

/**
 * Un dato personal para los logs: del usuario (que puede ser el DNI) o del email, solo el principio. El
 * dominio del email queda, porque dice de qué universidad es.
 */
export function masked(value: string): string {
    const at = value.lastIndexOf("@");
    const local = at === -1 ? value : value.slice(0, at);
    const hidden = `${local.slice(0, Math.min(2, Math.floor(local.length / 3)))}…`;
    return at === -1 ? hidden : hidden + value.slice(at);
}

/** Un mensaje de error sin números de 7 u 8 dígitos, con o sin puntos: puede traer un DNI o un legajo. */
export const withoutIds = (text: string) => text.replace(/\b\d{1,2}\.?\d{3}\.?\d{3}\b/g, "[número]");
