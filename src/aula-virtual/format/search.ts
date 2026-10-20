import { getCourseSections, getForumDiscussions, getUserCourses } from "../client/moodle.js";
import type { AulaSession } from "../client/session.js";
import type { Course, CourseModule } from "../client/types.js";
import { discussionAddr, moduleAddr, parseAddress, sectionAddr } from "./address.js";
import { cleanName, isoDate, richText } from "./fields.js";
import { BUDGET_CHARS } from "./files.js";

/** Caracteres de texto a cada lado de la coincidencia en el `fragmento`. */
const CONTEXT_CHARS = 80;

/** Algo del aula donde se puede buscar: lo que ve el modelo si coincide y el texto en el que se busca. */
interface Candidate {
    result: Record<string, unknown> & { nombre?: string };
    text: string;
}

/**
 * Busca palabras en las secciones, los módulos, los nombres de archivo y las discusiones de los foros de
 * uno o de todos los cursos. UNJu no tiene la búsqueda global de Moodle (`core_search_get_results`), así
 * que se busca sobre lo mismo que descarga abrir un curso. Dentro de los archivos no se busca: habría que
 * bajarlos todos.
 */
export async function search(session: AulaSession, query: string, courseAddress?: string) {
    const all = [...new Set(words(query))];
    const terms = all.filter(isSearchable);
    if (!terms.length) {
        throw new Error(
            all.length
                ? `Las palabras de menos de ${MIN_LETTERS} letras no se buscan (aparecen en casi todo): sumá una más larga, por ejemplo "parcial".`
                : 'La búsqueda está vacía: pasá una o más palabras en `consulta`, por ejemplo "parcial".',
        );
    }
    const ignored = all.filter((w) => !isSearchable(w));

    const courses = await coursesToSearch(session, courseAddress);
    const candidates = (await Promise.all(courses.map((c) => courseCandidates(session, c)))).flat();
    const matches = candidates.filter((c) => {
        const found = new Set([...words(c.result.nombre ?? ""), ...words(c.text)]);
        return terms.every((w) => found.has(w));
    });
    // Primero lo que coincide en el nombre; el orden estable deja el resto como aparece en el aula.
    const inName = (c: Candidate) => {
        const found = new Set(words(c.result.nombre ?? ""));
        return terms.every((w) => found.has(w));
    };
    matches.sort((a, b) => Number(inName(b)) - Number(inName(a)));

    const resultados = [];
    let spent = 0;
    for (const m of matches) {
        const result = { ...m.result, fragmento: inName(m) ? undefined : fragment(m.text, terms) };
        spent += JSON.stringify(result).length + 1;
        if (spent > BUDGET_CHARS) break;
        resultados.push(result);
    }
    const omitted = matches.length - resultados.length;
    return {
        consulta: query,
        palabrasIgnoradas: ignored.length ? ignored : undefined,
        cursosRevisados: courses.length,
        total: matches.length,
        resultados,
        recortado: omitted > 0 || undefined,
        resultadosOmitidos: omitted || undefined,
        sugerencia: matches.length
            ? undefined
            : "No hubo coincidencias. Se buscan palabras completas: probá con menos palabras, en singular o " +
              'plural, o con sinónimos. Los docentes nombran las cosas a su manera (por ejemplo, el foro de ' +
              'avisos puede llamarse "Novedades").',
    };
}

async function coursesToSearch(session: AulaSession, courseAddress?: string): Promise<Course[]> {
    const courses = await getUserCourses(session);
    if (!courseAddress) return courses;

    const address = parseAddress(courseAddress);
    if (address.level === "root") return courses;
    const course = courses.find((c) => c.id === address.courseId);
    if (!course) {
        throw new Error(
            `No estás inscripto en el curso ${address.courseId}. Usá aula_list_courses para ver tus cursos, ` +
                "o buscá sin `curso` para revisarlos todos.",
        );
    }
    return [course];
}

async function courseCandidates(session: AulaSession, course: Course): Promise<Candidate[]> {
    const curso = cleanName(course.fullname);
    const sections = (await getCourseSections(session, course.id)).filter((s) => s.uservisible !== false);
    const candidates: Candidate[] = [];
    for (const s of sections) {
        const seccion = cleanName(s.name);
        candidates.push({
            result: { direccion: sectionAddr(course.id, s.section), tipo: "seccion", nombre: seccion, curso },
            text: richText(session.site, s.summary),
        });
        for (const m of s.modules.filter((m) => m.uservisible)) {
            const files = (m.contents ?? []).filter((c) => c.type === "file").map((f) => f.filename);
            candidates.push({
                result: {
                    direccion: moduleAddr(course.id, m.id),
                    tipo: m.modname,
                    // Las etiquetas no tienen nombre propio: Moodle repite el principio de su texto.
                    nombre: m.modname === "label" ? undefined : cleanName(m.name),
                    curso,
                    seccion,
                },
                text: [richText(session.site, m.description), ...files].filter(Boolean).join("\n"),
            });
        }
    }
    const forums = sections.flatMap((s) => s.modules).filter((m) => m.modname === "forum" && m.uservisible);
    const discussions = await Promise.all(forums.map((f) => forumCandidates(session, course.id, curso, f)));
    return [...candidates, ...discussions.flat()];
}

/** Solo la primera página de cada foro (las 50 discusiones más recientes): alcanza para los avisos. */
async function forumCandidates(
    session: AulaSession,
    courseId: number,
    curso: string,
    forum: CourseModule,
): Promise<Candidate[]> {
    // Un foro que no deja leer sus discusiones no corta la búsqueda en los demás.
    const { discussions } = await getForumDiscussions(session, forum.instance).catch(() => ({ discussions: [] }));
    return discussions.map((d) => ({
        result: {
            direccion: discussionAddr(courseId, forum.id, d.discussion),
            tipo: "discusion",
            nombre: cleanName(d.subject),
            curso,
            foro: cleanName(forum.name),
            autor: d.userfullname,
            fecha: isoDate(d.created),
        },
        text: richText(session.site, d.message),
    }));
}

/**
 * Las palabras de menos letras ("a", "de", "la") aparecen en casi todo: no filtran resultados y movían el
 * fragmento al principio del texto. Los números se buscan aunque sean cortos: horas, días y aulas ("19").
 */
const MIN_LETTERS = 3;
const isSearchable = (w: string) => w.length >= MIN_LETTERS || /^\d+$/.test(w);

/** Minúsculas y sin tildes, para que "Estadística" coincida con "estadistica". */
const foldChar = (ch: string) => ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Las palabras de un texto, normalizadas: se compara palabra entera, "parcial" no encuentra "parciales". */
function words(text: string): string[] {
    return [...text].map(foldChar).join("").match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Texto alrededor de la zona con más palabras distintas de la búsqueda, para decidir si abrir el
 * resultado. Se recorre carácter por carácter para que las posiciones sigan valiendo en el texto original.
 */
function fragment(text: string, terms: string[]): string | undefined {
    const chars = [...text];
    const folded = chars.map(foldChar);
    // Dónde empieza y termina (en caracteres del original) cada palabra de la búsqueda que aparece.
    const hits: { word: string; start: number; end: number }[] = [];
    let i = 0;
    while (i < chars.length) {
        if (!/[\p{L}\p{N}]/u.test(folded[i])) {
            i++;
            continue;
        }
        let j = i;
        while (j < chars.length && /[\p{L}\p{N}]/u.test(folded[j])) j++;
        const word = folded.slice(i, j).join("");
        if (terms.includes(word)) hits.push({ word, start: i, end: j });
        i = j;
    }
    if (!hits.length) return undefined;

    // La ventana de 2 × CONTEXT_CHARS con más palabras distintas; si empatan, la que tiene más apariciones.
    const width = 2 * CONTEXT_CHARS;
    let best = { from: 0, to: 0, distinct: 0 };
    for (let from = 0, to = 0; from < hits.length; from++) {
        while (to + 1 < hits.length && hits[to + 1].end - hits[from].start <= width) to++;
        const distinct = new Set(hits.slice(from, to + 1).map((h) => h.word)).size;
        if (distinct > best.distinct || (distinct === best.distinct && to - from > best.to - best.from)) {
            best = { from, to, distinct };
        }
    }
    const zoneStart = hits[best.from].start;
    const zoneEnd = hits[best.to].end;
    const start = Math.max(0, Math.min(zoneStart - Math.floor((width - (zoneEnd - zoneStart)) / 2), chars.length - width));
    const end = Math.min(chars.length, start + width);
    const piece = chars.slice(start, end).join("").replace(/\s+/g, " ").trim();
    return `${start > 0 ? "…" : ""}${piece}${end < chars.length ? "…" : ""}`;
}
