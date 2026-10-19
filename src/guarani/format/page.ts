import { htmlToText } from "../../shared/html.js";
import { getPage, pageUrl, toAddress } from "../client/g3w.js";
import type { GuaraniSession } from "../client/session.js";
import type { Pagelet } from "../client/types.js";

/** Cuánto texto de las secciones se devuelve por página, en caracteres. */
const BUDGET_CHARS = 30_000;
/** Cuántos enlaces se listan por página: el menú de G3W tiene ~40. */
const MAX_LINKS = 80;
/** Las partes que son el menú o la barra de arriba, por su id; varía entre versiones de G3W. */
const MENU_PAGELET = /menu|barra|navbar|encabezado|header/i;

interface Link {
    texto: string;
    direccion: string;
}

/**
 * Abre una página de la autogestión y devuelve su texto por sección, los avisos y los enlaces a
 * otras páginas. La dirección vacía es la página de inicio del alumno.
 */
export async function openPage(session: GuaraniSession, address = "") {
    const page = await getPage(session, address);
    const content = page.pagelets.filter((p) => !MENU_PAGELET.test(p.id));

    const sections: { id: string; texto: string }[] = [];
    let spent = 0;
    let truncated = false;
    for (const p of content) {
        const text = tableAwareText(p.content);
        if (!text) continue;
        const room = BUDGET_CHARS - spent;
        if (room <= 0) {
            truncated = true;
            break;
        }
        const cut = text.length > room ? `${text.slice(0, room).trimEnd()}…` : text;
        truncated ||= cut !== text;
        sections.push({ id: p.id, texto: cut });
        spent += cut.length;
    }

    const links = collectLinks(session, page.url, content);
    return {
        direccion: toAddress(session.site, page.url),
        operacion: page.op || undefined,
        urlParaUsuario: page.url,
        avisos: notices(page.pagelets),
        secciones: sections,
        recortado: truncated || undefined,
        enlaces: links.length ? links.slice(0, MAX_LINKS) : undefined,
    };
}

/** El menú de la autogestión: las operaciones que habilitó la universidad para este alumno. */
export async function openMenu(session: GuaraniSession) {
    const page = await getPage(session, "");
    const menu = page.pagelets.filter((p) => MENU_PAGELET.test(p.id));
    // Si la versión de G3W nombra distinto al menú, mejor todos los enlaces que ninguno.
    const links = collectLinks(session, page.url, menu.length ? menu : page.pagelets);
    const header = menu.map((p) => tableAwareText(p.content)).filter(Boolean).join("\n");
    return {
        inicio: toAddress(session.site, page.url),
        encabezado: header ? header.slice(0, 2_000) : undefined,
        operaciones: links.slice(0, MAX_LINKS),
    };
}

/**
 * Texto de una parte con las tablas fila por fila y las celdas separadas por " | ": así se leen la
 * historia académica, las mesas y las inscripciones sin perder las columnas.
 */
function tableAwareText(html: string): string {
    return htmlToText(
        html
            .replace(/<(select|option)[\s\S]*?<\/\1>/gi, "")
            .replace(/<\/t[dh]>/gi, " | ")
            .replace(/<\/tr>/gi, "</tr>\n"),
    )
        .replace(/\s*\|\s*$/gm, "")
        .replace(/\n{3,}/g, "\n\n");
}

/** Los avisos que muestra G3W (`alert-*`): inscripción confirmada, períodos abiertos, errores. */
function notices(pagelets: Pagelet[]): string[] | undefined {
    const found = new Set<string>();
    for (const p of pagelets) {
        for (const m of p.content.matchAll(/<div[^>]*class=['"][^'"]*\balert\b[^'"]*['"][^>]*>([\s\S]*?)<\/div>/gi)) {
            const text = htmlToText(m[1]);
            if (text) found.add(text);
        }
    }
    return found.size ? [...found] : undefined;
}

/** Los enlaces a otras páginas de la autogestión, sin repetir y sin los de acceso (login, logout). */
function collectLinks(session: GuaraniSession, from: string, pagelets: Pagelet[]): Link[] {
    const seen = new Set<string>();
    const links: Link[] = [];
    for (const p of pagelets) {
        for (const m of p.content.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
            const href = m[1].match(/href=['"]([^'"]+)['"]/i)?.[1];
            if (!href || href.startsWith("#") || /^(javascript|mailto):/i.test(href)) continue;
            let address: string;
            try {
                address = toAddress(session.site, pageUrl(session.site, new URL(href.replaceAll("&amp;", "&"), from).href));
            } catch {
                continue; // externo o de acceso
            }
            const text = htmlToText(m[2]) || m[1].match(/title=['"]([^'"]+)['"]/i)?.[1] || "";
            if (!text || seen.has(address)) continue;
            seen.add(address);
            links.push({ texto: text.replace(/\s+/g, " "), direccion: address });
        }
    }
    return links;
}
