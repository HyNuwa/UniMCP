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
    children?: Node[];
}

export interface TextOptions {
    /** Selector de lo que se descarta con todo su contenido, además de scripts y estilos: botones, modales. */
    drop?: string;
    /** Las tablas fila por fila, una por línea, con las celdas separadas por " | ". */
    tableCells?: boolean;
}

/**
 * HTML a texto plano para el modelo. Lo parsea cheerio con parse5, el algoritmo del estándar, que corrige el
 * HTML mal formado (G3W deja etiquetas sin cerrar) y decodifica todas las entidades.
 */
export function htmlToText(html: string | undefined, options: TextOptions = {}): string {
    if (!html) return "";
    const $ = load(html, null, false);
    $(NOT_TEXT).remove();
    if (options.drop) $(options.drop).remove();
    return normalize(render($.root()[0].children as unknown as Node[], options));
}

/** Igual que htmlToText, pero recortado, para índices donde solo hay que decidir si entrar. */
export function htmlToSnippet(html: string | undefined, max = 200): string {
    const text = htmlToText(html);
    return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function render(nodes: Node[], options: TextOptions): string {
    let text = "";
    for (const node of nodes) {
        if (node.type === "text") text += node.data ?? "";
        else if (node.type === "tag") text += renderElement(node, options);
    }
    return text;
}

function renderElement(el: Node, options: TextOptions): string {
    if (el.name === "br") return "\n";
    if (options.tableCells && el.name === "tr") {
        const cells = (el.children ?? [])
            .filter((c) => c.name === "td" || c.name === "th")
            // Dentro de una celda todo va en una línea: si no, la fila se parte y se pierden las columnas.
            .map((c) => render(c.children ?? [], options).replace(/\s+/g, " ").trim());
        // Una fila que solo tenía botones queda vacía y no aporta nada.
        return cells.some(Boolean) ? `\n${cells.join(" | ")}\n` : "\n";
    }
    const inner = render(el.children ?? [], options);
    // Un bloque corta la línea al abrir y al cerrar. Los elementos en línea no suman espacios: parten
    // palabras ("d<span>eben</span>", "chi<sup>2</sup>").
    return BLOCK.has(el.name ?? "") ? `\n${inner}\n` : inner;
}

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
