import type { AulaSite } from "../../shared/campus.js";
import { htmlToText, safeUrl } from "../../shared/html.js";
import type { MoodleFile } from "../client/types.js";
import { userFacingUrl } from "./files.js";

/**
 * Texto rico del aula (resúmenes, etiquetas, mensajes, devoluciones) con la URL de cada link e iframe: el
 * docente escribe "LINK" y la dirección de la clase está en el href. Las URLs van sin credenciales y las
 * del propio aula abren con la sesión del navegador.
 */
export const richText = (site: AulaSite, html: string | undefined) =>
    htmlToText(html, { links: linkOptions(site) });

/** Una URL del aula o de afuera lista para el modelo, con las mismas reglas que los links de richText. */
export const safeLink = (site: AulaSite, url: string) => safeUrl(url, linkOptions(site));

const linkOptions = (site: AulaSite) => ({ base: site.baseUrl, rewrite: userFacingUrl });

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
