import { openDocument, UnsupportedFormat, type Part } from "../../shared/documents/index.js";
import type { AulaSite } from "../../shared/campus.js";
import { fetchFile } from "../client/web-service.js";
import type { AulaSession } from "../client/session.js";

const WS_PATH = "/webservice/pluginfile.php/";
const WEB_PATH = "/pluginfile.php/";

/** Presupuesto por llamada, en caracteres de texto. */
const BUDGET_CHARS = 30_000;
/** Costo de una página como imagen (unos 1.600 tokens) expresado en caracteres de texto. */
const IMAGE_COST_CHARS = 6_000;
/** El archivo más pesado que encontramos en los cursos tiene 12 MB. */
const MAX_BYTES = 30 * 1024 * 1024;

/** Origen y path base del Moodle; algunos campus están en una subcarpeta (`https://host/moodle`). */
function moodleRoot(site: AulaSite): { origin: string; base: string } {
    const u = new URL(site.baseUrl);
    return { origin: u.origin, base: u.pathname.replace(/\/+$/, "") };
}

/**
 * Las URLs que da Moodle son las del web service y necesitan token. Para el usuario sirve la misma ruta
 * sin `/webservice`, que abre con la sesión del navegador; es la única que se muestra, así el token se
 * queda en el servidor. Como las genera Moodle, no hace falta saber de qué campus son.
 */
export function userFacingUrl(fileurl: string): string {
    return fileurl.replace(WS_PATH, WEB_PATH);
}

/**
 * Recibe cualquiera de las dos variantes y devuelve la del web service. Solo admite archivos del aula:
 * con otra URL le estaríamos entregando el token del usuario a cualquier sitio que proponga el modelo.
 */
function downloadUrl(site: AulaSite, url: string): URL {
    let u: URL;
    try {
        u = new URL(url);
    } catch {
        throw new Error(`URL inválida: "${url}". Usá la \`url\` de un archivo tal como la devuelve aula_open.`);
    }
    const { origin, base } = moodleRoot(site);
    const ws = base + WS_PATH;
    const web = base + WEB_PATH;
    const path = u.pathname.startsWith(ws) ? u.pathname : u.pathname.startsWith(web) ? ws + u.pathname.slice(web.length) : null;
    if (u.origin !== origin || !path) {
        throw new Error(`Solo se pueden leer archivos del aula virtual (${origin}${web}...).`);
    }
    u.pathname = path;
    u.searchParams.delete("token");
    u.searchParams.delete("wstoken");
    return u;
}

/** Resultado de una lectura tal como lo ve el modelo (claves en español), más las partes leídas. */
export interface FileRead {
    archivo: string;
    formato: string;
    unidad: string;
    total: number;
    desde: number;
    hasta: number;
    /** Valor de `desde` para seguir leyendo; ausente cuando ya no queda nada. */
    siguiente?: number;
    urlParaUsuario: string;
    parts: (Part & { number: number })[];
}

/**
 * Descarga un archivo del aula y devuelve, desde la parte `from`, todas las que entren en el
 * presupuesto.
 */
export async function readAulaFile(session: AulaSession, url: string, from = 1): Promise<FileRead> {
    const download = downloadUrl(session.site, url);
    const fileName = decodeURIComponent(download.pathname.split("/").pop() ?? "");
    const forUser = userFacingUrl(download.href);

    const { bytes } = await fetchFile(session, download, MAX_BYTES);

    let doc;
    try {
        doc = await openDocument(bytes, fileName);
    } catch (e) {
        if (e instanceof UnsupportedFormat) {
            throw new Error(`${e.message} El usuario lo puede bajar desde ${forUser}`);
        }
        throw e;
    }

    try {
        if (from > doc.total) {
            throw new Error(`"${fileName}" termina en ${doc.unit} ${doc.total}; se pidió desde ${from}.`);
        }

        const parts: FileRead["parts"] = [];
        let spent = 0;
        let n = from;
        for (; n <= doc.total; n++) {
            const part = await doc.part(n);
            const cost = "text" in part ? part.text.length : IMAGE_COST_CHARS;
            // Al menos una parte, aunque por sí sola supere el presupuesto.
            if (parts.length > 0 && spent + cost > BUDGET_CHARS) break;
            parts.push({ ...part, number: n });
            spent += cost;
        }

        return {
            archivo: fileName,
            formato: doc.format,
            unidad: doc.unit,
            total: doc.total,
            desde: from,
            hasta: n - 1,
            siguiente: n <= doc.total ? n : undefined,
            urlParaUsuario: forUser,
            parts,
        };
    } finally {
        await doc.close();
    }
}
