/**
 * Hora argentina, en minutos respecto de UTC. Es fija: Argentina no usa horario de verano desde 2009. No se
 * toma de la máquina porque el servidor hosteado no corre en hora argentina.
 */
const ARGENTINA_OFFSET_MINUTES = -180;

/**
 * Timestamp de Moodle (en segundos) a ISO 8601 en hora argentina, por ejemplo "2026-10-15T22:30:00-03:00":
 * en UTC una publicación de la noche figura como del día siguiente. 0 o vacío significa sin fecha.
 */
export const isoDate = (seconds: number | null | undefined) =>
    seconds
        ? new Date((seconds + ARGENTINA_OFFSET_MINUTES * 60) * 1000).toISOString().slice(0, 19) + "-03:00"
        : null;

/** El día de hoy en Argentina, "aaaa-mm-dd": a las 22 h en Argentina, en UTC ya es mañana. */
export const argentinaDay = (now = new Date()) =>
    new Date(now.getTime() + ARGENTINA_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
