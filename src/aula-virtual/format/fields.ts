import type { AulaSite } from "../../shared/campus.js";
import { isoDate } from "../../shared/dates.js";
import { htmlToText, safeUrl } from "../../shared/html.js";
import type { MoodleFile } from "../client/types.js";
import { userFacingUrl } from "./files.js";

/** Lo usan todos los formatos del aula; vive en shared porque Guaraní también fecha en hora argentina. */
export { isoDate };

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
