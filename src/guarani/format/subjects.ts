/** Las palabras de un nombre, en minúsculas y sin tildes: "Análisis" encuentra "ANALISIS". */
const words = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Desde cuántas letras una palabra pedida vale como comienzo de otra ("prob" → "probabilidades"). */
const MIN_PREFIX = 3;

/**
 * Si una materia coincide con lo que pidió el modelo en `materia`: el código ("IF159") o palabras del nombre
 * ("analisis ii", "prob estadistica"). Cada palabra tiene que ser una del nombre, o su comienzo si tiene 3
 * letras o más: así "analisis ii" no encuentra "Análisis Matemático I". Sin filtro, coinciden todas.
 */
export function matchesSubject(query: string | undefined, subject: { materia: string; codigo?: string }): boolean {
    const wanted = words(query ?? "");
    if (!wanted.length) return true;
    if (subject.codigo && words(subject.codigo).join("") === wanted.join("")) return true;
    const name = words(subject.materia);
    return wanted.every((w) => name.some((n) => n === w || (w.length >= MIN_PREFIX && n.startsWith(w))));
}
