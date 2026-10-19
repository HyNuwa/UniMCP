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
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) {
        throw new Error('La búsqueda está vacía: pasá una o más palabras en `consulta`, por ejemplo "parcial".');
    }

    const courses = await coursesToSearch(session, courseAddress);
    const candidates = (await Promise.all(courses.map((c) => courseCandidates(session, c)))).flat();
    const matches = candidates.filter((c) => {
        const haystack = normalize(`${c.result.nombre ?? ""}
${c.text}`);
        return words.every((w) => haystack.includes(w));
    });
    // Primero lo que coincide en el nombre; el orden estable deja el resto como aparece en el aula.
    const inName = (c: Candidate) => words.every((w) => normalize(c.result.nombre ?? "").includes(w));
    matches.sort((a, b) => Number(inName(b)) - Number(inName(a)));

    const resultados = [];
    let spent = 0;
    for (const m of matches) {
        const result = { ...m.result, fragmento: inName(m) ? undefined : fragment(m.text, words) };
        spent += JSON.stringify(result).length + 1;
        if (spent > BUDGET_CHARS) break;
        resultados.push(result);
    }
    const omitted = matches.length - resultados.length;
    return {
        consulta: query,
        cursosRevisados: courses.length,
        total: matches.length,
        resultados,
        recortado: omitted > 0 || undefined,
        resultadosOmitidos: omitted || undefined,
        sugerencia: matches.length
            ? undefined
            : "No hubo coincidencias. Probá con menos palabras o con sinónimos: los docentes nombran las " +
              'cosas a su manera (por ejemplo, el foro de avisos puede llamarse "Novedades").',
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

/** Minúsculas y sin tildes, para que "Estadística" coincida con "estadistica". */
function normalize(text: string): string {
    return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Texto alrededor de la primera palabra encontrada, para decidir si abrir el resultado. */
function fragment(text: string, words: string[]): string | undefined {
    const normalized = normalize(text);
    const at = Math.min(...words.map((w) => normalized.indexOf(w)).filter((i) => i >= 0));
    if (!Number.isFinite(at)) return undefined;
    const start = Math.max(0, at - CONTEXT_CHARS);
    const end = Math.min(text.length, at + CONTEXT_CHARS);
    const piece = text.slice(start, end).replace(/\s+/g, " ").trim();
    return `${start > 0 ? "…" : ""}${piece}${end < text.length ? "…" : ""}`;
}
