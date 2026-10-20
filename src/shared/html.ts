import { load } from "cheerio";

/** Lo que nunca es texto para leer. */
const NOT_TEXT = "script, style, noscript, template";

/** Elementos en bloque: su contenido va en su propia línea, así no se pegan las palabras de dos bloques. */
const BLOCK = new Set([
    "address", "article", "aside", "blockquote", "dd", "details", "div", "dl", "dt", "fieldset", "figcaption",
    "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "legend", "li", "main", "nav",
    "ol", "p", "pre", "section", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

/** Lo justo del árbol de cheerio (domhandler) que se recorre: texto y elementos; los comentarios se saltean. */
interface Node {
    type: string;
    data?: string;
    name?: string;
    attribs?: Record<string, string>;
    children?: Node[];
}

/**
 * Parámetros de URL que son credenciales: con ellos el link abre como el usuario o con su sesión. Se
 * quitan siempre antes de mostrarle una URL al modelo (los de Moodle, los de las firmas de S3 y los
 * genéricos).
 */
const CREDENTIAL_PARAMS =
    /^(token|wstoken|privatetoken|sesskey|moodlesession|phpsessid|sessionid|session|access_token|id_token|refresh_token|auth|authtoken|apikey|api_key|password|passwd|pass|pwd|secret|client_secret|x-amz-signature|x-amz-credential|x-amz-security-token|signature|sig)$/i;

/** Cómo se muestran las URLs de links e iframes. Sin esto se muestra solo el texto del link. */
export interface LinkOptions {
    /** Contra qué se resuelven las URLs relativas: la URL del sitio. */
    base: string;
    /** Un último paso propio de la plataforma, como `userFacingUrl` en el aula. */
    rewrite?: (url: string) => string;
}

export interface TextOptions {
    /** Selector de lo que se descarta con todo su contenido, además de scripts y estilos: botones, modales. */
    drop?: string;
    /** Links como "texto (url)" e iframes con su URL, sin credenciales. */
    links?: LinkOptions;
}

/** Opciones del recorrido: además de las de afuera, si se está adentro de una celda (tablas anidadas). */
interface RenderOptions extends TextOptions {
    inCell?: boolean;
}

/**
 * HTML a texto para el modelo. Lo parsea cheerio con parse5, el algoritmo del estándar, que corrige el
 * HTML mal formado (G3W deja etiquetas sin cerrar) y decodifica todas las entidades. Los títulos van con
 * `#`, los ítems de lista con `- ` y las tablas fila por fila con las celdas separadas por " | ".
 */
export function htmlToText(html: string | undefined, options: TextOptions = {}): string {
    if (!html) return "";
    const $ = load(html, null, false);
    $(NOT_TEXT).remove();
    if (options.drop) $(options.drop).remove();
    const text = cleanUrls(render($.root()[0].children as unknown as Node[], options), options.links);
    return normalize(options.links ? placeLinks(text) : text);
}

/** Marcas de dónde va la URL de un link con texto; placeLinks la ubica al final de la palabra. */
const LINK_START = "\u0001";
const LINK_END = "\u0002";

/** Una URL escrita en el texto, sin la puntuación que la cierra ("…/clase."). */
const URL_IN_TEXT = /https?:\/\/[^\s<>"'()[\]\u0001\u0002]+[^\s<>"'()[\]\u0001\u0002.,;:!?]/g;

/**
 * Las URLs del texto también, no solo las de los links: un docente puede pegar una con `token=`. Se limpian
 * siempre, aunque no se muestren los links; sin `links` quedan como están, solo sin credenciales.
 */
const cleanUrls = (text: string, links?: LinkOptions) =>
    text.replace(URL_IN_TEXT, (u) => (links ? safeUrl(u, links) : withoutCredentials(u)) ?? u);

/**
 * La URL de un link va después de la palabra donde termina el link: si el docente enlazó solo la "G" de
 * "Gabinete", queda "Gabinete (url)" y no "G (url)abinete".
 */
const placeLinks = (text: string) =>
    text.replace(new RegExp(`${LINK_START}([^${LINK_END}]*)${LINK_END}([\\p{L}\\p{N}]*)`, "gu"), "$2 ($1)");

/** Igual que htmlToText, pero recortado, para índices donde solo hay que decidir si entrar. */
export function htmlToSnippet(html: string | undefined, max = 200): string {
    const text = htmlToText(html);
    return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/**
 * Una URL que se le puede mostrar al modelo: absoluta, http(s) o mailto, y sin credenciales. Si no es
 * ninguna de esas, `undefined`.
 */
export function safeUrl(raw: string, { base, rewrite }: LinkOptions): string | undefined {
    let u: URL;
    try {
        u = new URL(raw.trim(), base);
    } catch {
        return undefined;
    }
    if (!/^(https?|mailto):$/.test(u.protocol)) return undefined;
    stripCredentials(u);
    const href = youtubeShort(u) ?? u.href;
    return rewrite ? rewrite(href) : href;
}

/**
 * Una URL absoluta sin usuario, contraseña ni parámetros de credencial. Si no tenía ninguno vuelve tal cual:
 * `URL` la reescribiría ("https://x.com" → "https://x.com/") y es texto del docente.
 */
export function withoutCredentials(url: string): string {
    let u: URL;
    try {
        u = new URL(url);
    } catch {
        return url;
    }
    const hasCredentials = u.username || u.password || [...u.searchParams.keys()].some((k) => CREDENTIAL_PARAMS.test(k));
    return hasCredentials ? stripCredentials(u).href : url;
}

function stripCredentials(u: URL): URL {
    u.username = "";
    u.password = "";
    for (const key of [...u.searchParams.keys()]) {
        if (CREDENTIAL_PARAMS.test(key)) u.searchParams.delete(key);
    }
    return u;
}

/** Los hosts de YouTube que usan los docentes: el embed, el sitio, el móvil y el de privacidad. */
const YOUTUBE_HOST = /^(www\.|m\.)?youtube(-nocookie)?\.com$/;

/**
 * Un video de YouTube como `https://youtu.be/ID`: el embed trae parámetros de reproducción (`autoplay`,
 * `si`, `rel`) que al modelo no le sirven, y un curso con 73 videos los paga en cada respuesta. Solo se
 * conserva desde qué segundo empieza.
 */
function youtubeShort(u: URL): string | undefined {
    if (!YOUTUBE_HOST.test(u.hostname)) return undefined;
    const id = /^\/(embed|shorts|live)\/([\w-]{6,})/.exec(u.pathname)?.[2] ?? (u.pathname === "/watch" ? u.searchParams.get("v") : null);
    if (!id || !/^[\w-]+$/.test(id)) return undefined;
    const start = u.searchParams.get("start") ?? u.searchParams.get("t");
    return `https://youtu.be/${id}${start && /^\d+s?$/.test(start) ? `?t=${start.replace(/s$/, "")}` : ""}`;
}

function render(nodes: Node[], options: RenderOptions): string {
    let text = "";
    for (const node of nodes) {
        if (node.type === "text") text += node.data ?? "";
        else if (node.type === "tag") text += renderElement(node, options);
    }
    return text;
}

/** El texto de un elemento en una sola línea: para celdas, títulos e ítems de lista. */
const oneLine = (el: Node, options: RenderOptions) => render(el.children ?? [], options).replace(/\s+/g, " ").trim();

function renderElement(el: Node, options: RenderOptions): string {
    const name = el.name ?? "";
    if (name === "br") return "\n";
    if (name === "table") {
        const rows = tableRows(el, options);
        // Una tabla adentro de una celda queda en la línea de la fila de afuera.
        return options.inCell ? ` ${rows.join(" / ")} ` : `\n${rows.join("\n")}\n`;
    }
    const heading = /^h([1-6])$/.exec(name);
    if (heading) {
        const title = oneLine(el, options);
        // Adentro de una celda los `#` no marcan nada: G3W pone cada comisión en un `h5`.
        if (options.inCell) return ` ${title} `;
        return title ?`\n${"#".repeat(Number(heading[1]))} ${title}\n` : "\n";
    }
    if (name === "li") {
        // Una lista adentro de otra sigue en sus propias líneas, después del ítem.
        const inner = render(el.children ?? [], options).trim();
        // G3W pone títulos adentro de ítems: "- #### 1º anual" no aporta el guion.
        return inner ? `\n${inner.startsWith("#") ? "" : "- "}${inner}\n` : "\n";
    }
    if (options.links && name === "iframe") {
        const src = attr(el, "src");
        const url = src && safeUrl(src, options.links);
        return url ? `\n[Contenido incrustado: ${url}]\n` : "";
    }
    const inner = render(el.children ?? [], options);
    if (options.links && name === "a") return linkText(inner, attr(el, "href"), options.links);
    // Un bloque corta la línea al abrir y al cerrar. Los elementos en línea no suman espacios: parten
    // palabras ("d<span>eben</span>", "chi<sup>2</sup>").
    return BLOCK.has(name) ? `\n${inner}\n` : inner;
}

/** "texto (url)", o solo la URL si el link no tiene texto o su texto ya es la URL. */
function linkText(inner: string, href: string | undefined, links: LinkOptions): string {
    if (!href || href.startsWith("#")) return inner;
    const url = safeUrl(href, links);
    if (!url) return inner;
    const text = inner.replace(/\s+/g, " ").trim();
    const shown = url.replace(/^mailto:/, "");
    // Un link cuyo texto ya es una URL (o una dirección de mail) se muestra con la del href, que está limpia.
    // Con espacios alrededor: si no, se pega a lo de al lado ("Clave: 2026https://…", dos links seguidos).
    if (!text || /^(https?:\/\/|www\.)\S+$/i.test(text) || text === shown) return ` ${shown} `;
    return `${inner}${LINK_START}${shown}${LINK_END}`;
}

const attr = (el: Node, name: string) => el.attribs?.[name];

/** Una celda ubicada en la grilla: la misma celda ocupa todos los lugares que cubren su colspan y rowspan. */
interface Slot {
    cell: Node;
    text: string;
    /** Es el primer lugar de la celda en su fila: los demás son el colspan. */
    colStart: boolean;
    /** La celda empieza en esta fila: si no, viene de un rowspan de más arriba. */
    rowStart: boolean;
}

/** Tope de colspan y rowspan, por si el HTML trae un número absurdo. */
const MAX_SPAN = 50;

const span = (el: Node, name: "colspan" | "rowspan") => {
    const n = Number.parseInt(attr(el, name) ?? "1", 10);
    return n >= 1 ? Math.min(n, MAX_SPAN) : 1;
};

const cellsOf = (row: Node) => (row.children ?? []).filter((n) => n.name === "td" || n.name === "th");

/** Las filas de la tabla, sin las de las tablas anidadas. */
function directRows(table: Node): { row: Node; inHead: boolean }[] {
    const rows: { row: Node; inHead: boolean }[] = [];
    for (const child of table.children ?? []) {
        if (child.name === "tr") rows.push({ row: child, inHead: false });
        else if (child.name === "thead" || child.name === "tbody" || child.name === "tfoot") {
            for (const tr of child.children ?? []) if (tr.name === "tr") rows.push({ row: tr, inHead: child.name === "thead" });
        }
    }
    return rows;
}

/**
 * Una tabla fila por fila, con las celdas separadas por " | ". Primero se arma la grilla entera con los
 * colspan y rowspan, así cada valor queda en su columna. Un encabezado de varias filas ("2da Clase" sobre
 * "Día y horario | Lugar") se combina en una sola fila con un nombre por columna: "2da Clase · Lugar".
 * En los datos, una celda con rowspan se repite en cada fila (así cada fila se lee sola) y una con colspan
 * va una vez.
 */
function tableRows(table: Node, options: RenderOptions): string[] {
    const rows = directRows(table);
    const cellOptions = { ...options, inCell: true };
    const grid: (Slot | undefined)[][] = rows.map(() => []);
    rows.forEach(({ row }, r) => {
        let c = 0;
        for (const cell of cellsOf(row)) {
            while (grid[r][c]) c++;
            const text = oneLine(cell, cellOptions);
            const colspan = span(cell, "colspan");
            const rowspan = Math.min(span(cell, "rowspan"), rows.length - r);
            for (let dr = 0; dr < rowspan; dr++) {
                for (let dc = 0; dc < colspan; dc++) {
                    grid[r + dr][c + dc] = { cell, text, colStart: dc === 0, rowStart: dr === 0 };
                }
            }
            c += colspan;
        }
    });

    const head = headerRows(rows);
    const lines: string[] = [];
    if (head > 1) {
        const width = Math.max(...grid.slice(0, head).map((g) => g.length));
        const names = Array.from({ length: width }, (_, c) => {
            const parts: Slot[] = [];
            for (let r = 0; r < head; r++) {
                const slot = grid[r][c];
                // La misma celda bajando por un rowspan, o un nombre vacío, no se repite.
                if (slot?.text && !parts.some((p) => p.cell === slot.cell)) parts.push(slot);
            }
            return parts.map((p) => p.text).join(" · ");
        });
        if (names.some(Boolean)) lines.push(names.join(" | "));
    }
    for (let r = head > 1 ? head : 0; r < rows.length; r++) {
        const slots = grid[r].filter((slot): slot is Slot => !!slot && slot.colStart);
        // Una fila que solo tenía botones queda vacía y no aporta nada, aunque le llegue un rowspan de arriba.
        if (slots.some((slot) => slot.rowStart && slot.text)) lines.push(slots.map((slot) => slot.text).join(" | "));
    }
    return lines;
}

/**
 * Cuántas filas de arriba son encabezado: las de `thead`, las que son todas `th`, o una primera fila que
 * agrupa columnas (colspan) con celdas que bajan (rowspan), como arman los docentes con `td`.
 */
function headerRows(rows: { row: Node; inHead: boolean }[]): number {
    let head = 0;
    while (head < rows.length && (rows[head].inHead || isAllTh(rows[head].row))) head++;
    const first = rows.length ? cellsOf(rows[0].row) : [];
    if (first.some((c) => span(c, "colspan") > 1) && first.some((c) => span(c, "rowspan") > 1)) {
        head = Math.max(head, ...first.map((c) => Math.min(span(c, "rowspan"), rows.length)));
    }
    // Sin datos abajo no es un encabezado: es una tabla de puros `th`, como los filtros de G3W.
    return head < rows.length ? head : 0;
}

const isAllTh = (row: Node) => {
    const cells = cellsOf(row);
    return cells.length > 0 && cells.every((c) => c.name === "th");
};

function normalize(text: string): string {
    return text
        .replace(/[ \t ]+/g, " ")
        .replace(/\s*\n\s*/g, "\n")
        .trim();
}

/**
 * Texto plano del modelo a HTML para Moodle: escapa los caracteres y cada línea en blanco separa
 * párrafos.
 */
export function textToHtml(text: string): string {
    const escaped = text
        .trim()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    return escaped
        .split(/\n\s*\n/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
}
