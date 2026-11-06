/** El hilo de GitHub Discussions donde cada uno pega su `unimcp check`: la web pone su usuario en el pin de su campus. */
export const TESTED_THREAD = { number: 64, url: "https://github.com/HyNuwa/UniMCP/discussions/64" };

/** El título con que empieza el resumen de `unimcp check`. */
export const CHECK_HEADING = "### unimcp check";

/** La línea del resumen que dice qué campus se probó; `checkedCampus` la lee de vuelta. */
export const campusLine = (campus: { id: string; universidad: string; nombre: string }) =>
    `- Campus: \`${campus.id}\` (${campus.universidad} · ${campus.nombre})`;

/** El id del campus de un resumen de `unimcp check` pegado en el hilo, o undefined si el texto no es uno. */
export function checkedCampus(text: string): string | undefined {
    if (!text.includes(CHECK_HEADING)) return undefined;
    return /^\s*- Campus: `([a-z0-9-]+)`/m.exec(text)?.[1];
}
