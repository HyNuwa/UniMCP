import type { MoodleFile } from "../client/types.js";
import { userFacingUrl } from "./files.js";

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

/** Moodle guarda nombres con saltos de línea y espacios de más, sobre todo en las etiquetas. */
export const cleanName = (name: string) => name.replace(/\s+/g, " ").trim();

export function toFile(f: MoodleFile) {
    return {
        nombre: f.filename,
        ruta: f.filepath || undefined,
        tamanio: f.filesize,
        mimetype: f.mimetype,
        modificado: isoDate(f.timemodified),
        // Le sirve al usuario para bajarlo y al modelo para leerlo con aula_read_file.
        url: userFacingUrl(f.fileurl),
    };
}

/** Lo justo de un archivo para un mapa de curso o de sección: leerlo con aula_read_file pide la `url`. */
export function toFileSummary(f: MoodleFile) {
    return { nombre: f.filename, url: userFacingUrl(f.fileurl), modificado: isoDate(f.timemodified) };
}
