import type { MoodleFile } from "../client/types.js";
import { userFacingUrl } from "./files.js";

/** Timestamp de Moodle (en segundos) a ISO; 0 o vacío significa sin fecha. */
export const isoDate = (seconds: number | null | undefined) =>
    seconds ? new Date(seconds * 1000).toISOString() : null;

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
