import { load } from "cheerio";
import { htmlToText, withoutCredentials } from "../../shared/html.js";
import { getPage, pageUrl, toAddress } from "../client/g3w.js";
import type { GuaraniSession } from "../client/session.js";
import type { G3wPage, Pagelet } from "../client/types.js";

/** Cuánto texto de las secciones se devuelve por página, en caracteres. */
const BUDGET_CHARS = 30_000;
/** Cuántos enlaces se listan por página: el menú de G3W tiene ~40. */
const MAX_LINKS = 80;
/** Las partes que son el menú o la barra de arriba, por su id; varía entre versiones de G3W. */
const MENU_PAGELET = /menu|barra|navbar|encabezado|header/i;
/**
 * Lo que no es contenido en una página de G3W: controles de formulario, botones de Bootstrap ("Imprimir",
 * "Ver"), modales ("×", "Confirmar") y los avisos, que ya van aparte en `avisos`. Los `<form>` quedan:
 * la historia académica viene adentro de uno.
 */
const NOISE = "select, option, button, input, textarea, .btn, .modal, .alert";
/** Los avisos de G3W: inscripción confirmada, períodos abiertos, errores. */
const NOTICE = ".alert";

interface Link {
    texto: string;
    direccion: string;
}

/**
 * Abre una página de la autogestión y devuelve su texto por sección, los avisos y los enlaces a
 * otras páginas. La dirección vacía es la página de inicio del alumno.
 */
export async function openPage(session: GuaraniSession, address = "") {
    const page = await withAllFilters(session, await getPage(session, address));
    const content = page.pagelets.filter((p) => !MENU_PAGELET.test(p.id));

    const sections: { id: string; texto: string }[] = [];
    let spent = 0;
    let truncated = false;
    for (const p of content) {
        const text = pageletText(p.content);
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

    // Sin el ruido: los botones con href son acciones ("Enviar por mail" manda el comprobante), no páginas.
    const links = collectLinks(session, page.url, content.map((p) => p.content), NOISE);
    return {
        direccion: toAddress(session.site, page.url),
        operacion: page.op || undefined,
        propuesta: careers(page.shell, page.op).propuesta,
        urlParaUsuario: withoutCredentials(page.url),
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
    // Algunas versiones mandan el menú como una parte; UNJu lo manda en el HTML de la página.
    const links = collectLinks(session, page.url, menu.length ? menu.map((p) => p.content) : [page.shell]);
    const header = menu.map((p) => pageletText(p.content)).filter(Boolean).join("\n");
    return {
        inicio: toAddress(session.site, page.url),
        encabezado: header ? header.slice(0, 2_000) : undefined,
        ...careers(page.shell, page.op),
        operaciones: links.slice(0, MAX_LINKS),
    };
}

/**
 * Las propuestas (carreras) del alumno, del selector de G3W: historia, plan e inscripciones son de la
 * activa. Las otras traen la dirección que la activa, que es la misma que usa el selector.
 */
function careers(shell: string, op: string | null) {
    const $ = load(shell);
    const found = $(".js-select-carreras")
        .map((_, a) => ({
            nombre: $(a).text().replace(/\s+/g, " ").trim(),
            id: $(a).attr("data-carrera-id"),
            activa: $(a).hasClass("selected"),
        }))
        .get();
    const others = found.filter((c) => !c.activa && c.id);
    return {
        propuesta: found.find((c) => c.activa)?.nombre,
        otrasPropuestas: others.length
            ? others.map((c) => ({
                  nombre: c.nombre,
                  direccion: `acceso/cambiar_carrera?id=${c.id}&op=${op || "inicio_alumno"}`,
              }))
            : undefined,
    };
}

/**
 * Algunas páginas (la historia académica) llegan con un formulario de filtros y sin datos: el JS de G3W
 * los pide al tocar un filtro. Se pide de nuevo con todas las casillas marcadas, leídas de la página.
 */
async function withAllFilters(session: GuaraniSession, page: G3wPage): Promise<G3wPage> {
    if (new URL(page.url).search) return page;
    const checks = page.pagelets.flatMap((p) => {
        const $ = load(p.content, null, false);
        return $('#form_filtros input[type="checkbox"]')
            .map((_, input) => $(input).attr("value"))
            .get();
    });
    if (!checks.length) return page;
    const query = new URLSearchParams({ checks: checks.join(",") });
    return getPage(session, `${toAddress(session.site, page.url)}?${query}`);
}

/**
 * Texto de una parte sin lo que no es contenido, con las tablas fila por fila y las celdas separadas por
 * " | ": así se leen la historia académica, las mesas y las inscripciones sin perder las columnas.
 */
function pageletText(html: string): string {
    return htmlToText(html, { drop: NOISE });
}

function notices(pagelets: Pagelet[]): string[] | undefined {
    const found = new Set<string>();
    for (const p of pagelets) {
        const $ = load(p.content, null, false);
        $(NOTICE).each((_, el) => {
            const text = htmlToText($(el).html() ?? "", { drop: "button" });
            if (text) found.add(text);
        });
    }
    return found.size ? [...found] : undefined;
}

/** Los enlaces a otras páginas de la autogestión, sin repetir y sin los de acceso (login, logout). */
function collectLinks(session: GuaraniSession, from: string, htmls: string[], drop?: string): Link[] {
    const seen = new Set<string>();
    const links: Link[] = [];
    for (const html of htmls) {
        const $ = load(html, null, false);
        if (drop) $(drop).remove();
        $("a[href]").each((_, a) => {
            const href = $(a).attr("href") ?? "";
            if (href.startsWith("#") || /^(javascript|mailto):/i.test(href)) return;
            let address: string;
            try {
                address = toAddress(session.site, pageUrl(session.site, new URL(href, from).href));
            } catch {
                return; // externo o de acceso
            }
            const text = linkText($(a).text().replace(/\s+/g, " ").trim() || $(a).attr("title") || "", address);
            if (!text || seen.has(address)) return;
            seen.add(address);
            links.push({ texto: text, direccion: address });
        });
    }
    return links;
}

/** Un enlace que es solo un ícono con un contador (el sobre de mensajes) se nombra por su dirección: "Mensajes (0)". */
function linkText(text: string, address: string): string {
    if (!/^\d+$/.test(text)) return text;
    const name = address.split(/[/?]/)[0].replaceAll("_", " ");
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} (${text})`;
}
