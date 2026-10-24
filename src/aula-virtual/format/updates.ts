import { getCourseModule, getUpdatesSince, getUserCourses } from "../client/moodle.js";
import type { AulaSession } from "../client/session.js";
import type { CourseUpdates, ModuleInfo } from "../client/types.js";
import { MoodleError } from "../client/web-service.js";
import { courseAddr, courseOf, moduleAddr } from "./address.js";
import { cleanName, isoDate } from "./fields.js";

const DAY_SECONDS = 86_400;
/** Rango por defecto, en días: la última semana. */
export const DEFAULT_UPDATE_DAYS = 7;
export const MAX_UPDATE_DAYS = 60;
/** Módulos por respuesta: cada uno es una llamada a Moodle para saber su nombre. */
const MAX_MODULES = 40;

/**
 * Lo que dice cada cambio de `core_course_get_updates_since`. Los que llevan `itemids` se cuentan; los que
 * no están acá se muestran con el nombre que les da Moodle.
 */
const CHANGES: Record<string, string> = {
    configuration: "editada",
    contentfiles: "archivos",
    introfiles: "archivos de la descripción",
    discussions: "discusiones con novedades",
    grades: "nota",
    gradeitems: "ítems de calificación",
    submissions: "entrega",
    attempts: "intentos",
    questions: "preguntas",
    completion: "finalización",
    comments: "comentarios",
    ratings: "valoraciones",
    entries: "entradas",
    responses: "respuestas",
    answers: "respuestas",
};

/** Qué cambió en el aula en los últimos `days` días, curso por curso. `now` se inyecta en los tests. */
export async function updates(
    session: AulaSession,
    options: { days?: number; course?: string } = {},
    now = new Date(),
) {
    const days = Math.min(Math.max(options.days ?? DEFAULT_UPDATE_DAYS, 1), MAX_UPDATE_DAYS);
    const courseId = options.course ? courseOf(options.course) : undefined;
    const since = Math.floor(now.getTime() / 1000) - days * DAY_SECONDS;

    const enrolled = await getUserCourses(session);
    const courses = courseId === undefined ? enrolled : enrolled.filter((c) => c.id === courseId);
    if (courseId !== undefined && !courses.length) {
        throw new Error(`No estás inscripto en el curso ${courseId}. Las direcciones salen de aula_list_courses.`);
    }

    const changed = await Promise.all(
        courses.map(async (c) => ({ course: c, modules: moduleUpdates(await getUpdatesSince(session, c.id, since)) })),
    );
    const withChanges = changed.filter((c) => c.modules.length);
    const total = withChanges.reduce((n, c) => n + c.modules.length, 0);

    // Los primeros MAX_MODULES, curso por curso, con su nombre.
    let budget = MAX_MODULES;
    const plan = withChanges.map(({ course, modules }) => {
        const shown = modules.slice(0, budget);
        budget -= shown.length;
        return { course, modules, shown };
    });
    const cursos = await Promise.all(
        plan.map(async ({ course, modules, shown }) => {
            const named = await Promise.all(shown.map(async (m) => ({ ...m, cm: await moduleOf(session, m.cmid) })));
            return {
                curso: cleanName(course.fullname),
                direccion: courseAddr(course.id),
                novedades: named
                    // Uno que no se puede abrir (oculto, borrado) no le sirve al usuario.
                    .filter((m) => m.cm)
                    .map((m) => ({
                        nombre: cleanName(m.cm!.name),
                        tipo: m.cm!.modname,
                        cambios: m.changes,
                        direccion: moduleAddr(course.id, m.cmid),
                    })),
                otrasNovedades: modules.length - shown.length || undefined,
            };
        }),
    );

    const cut = total > MAX_MODULES;
    return {
        desde: isoDate(since),
        cursos,
        sinNovedades: courses.length - withChanges.length || undefined,
        recortado: cut || undefined,
        aviso: cut
            ? `Cambiaron ${total} módulos y se muestran ${MAX_MODULES}. Pedí menos \`dias\` o filtrá por \`curso\`.`
            : undefined,
    };
}

/** Los módulos que cambiaron, cada uno con sus cambios en castellano ("archivos (3)"). */
function moduleUpdates({ instances }: CourseUpdates) {
    return instances
        .filter((i) => i.contextlevel === "module" && i.updates.length)
        .map((i) => ({
            cmid: i.id,
            changes: i.updates.map((u) => {
                const label = CHANGES[u.name] ?? u.name;
                return u.itemids?.length ? `${label} (${u.itemids.length})` : label;
            }),
        }));
}

async function moduleOf(session: AulaSession, cmid: number): Promise<ModuleInfo | undefined> {
    try {
        return await getCourseModule(session, cmid);
    } catch (e) {
        if (e instanceof MoodleError) return undefined;
        throw e;
    }
}
