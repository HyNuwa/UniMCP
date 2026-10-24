import { htmlToText } from "../../shared/html.js";
import { getGradeItems, getUserCourses } from "../client/moodle.js";
import type { AulaSession } from "../client/session.js";
import type { Course, GradeItem } from "../client/types.js";
import { MoodleError } from "../client/web-service.js";
import { courseAddr, courseOf, moduleAddr } from "./address.js";
import { cleanName, isoDate, richText } from "./fields.js";

/** Caracteres de cada devolución; la completa está al abrir la actividad. */
const FEEDBACK_CHARS = 1_500;

/** Lo que Moodle muestra en lugar de una nota que todavía no está. */
const NO_GRADE = "-";

const HIDDEN = "El docente no muestra las notas de este curso en el aula.";

/**
 * Las notas del usuario. Con `course`, cada ítem del libro de calificaciones de ese curso; sin él, un
 * resumen por curso.
 */
export async function grades(session: AulaSession, options: { course?: string } = {}) {
    const courseId = options.course ? courseOf(options.course) : undefined;
    const courses = await getUserCourses(session);
    if (courseId === undefined) {
        const cursos = await Promise.all(courses.map((c) => courseSummary(session, c)));
        // La más reciente de todas, para "¿qué nota me pusieron?" sin comparar curso por curso.
        const latest = cursos
            .flatMap((c) => ("ultimaNota" in c && c.ultimaNota ? [{ curso: c.curso, ...c.ultimaNota }] : []))
            .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))[0];
        return { ultimaNota: latest, cursos };
    }
    const course = courses.find((c) => c.id === courseId);
    if (!course) {
        throw new Error(`No estás inscripto en el curso ${courseId}. Las direcciones salen de aula_list_courses.`);
    }
    return courseGrades(session, course);
}

/** Moodle lo responde cuando el docente ocultó el libro de calificaciones. */
const isHidden = (e: unknown) => e instanceof MoodleError && e.errorcode === "nopermissiontoviewgrades";

async function courseSummary(session: AulaSession, course: Course) {
    const curso = cleanName(course.fullname);
    const direccion = courseAddr(course.id);
    let items: GradeItem[];
    try {
        items = await getGradeItems(session, course.id);
    } catch (e) {
        if (isHidden(e)) return { curso, direccion, notasOcultas: true };
        throw e;
    }
    const graded = items.filter((i) => isActivity(i) && gradeOf(i));
    const latest = graded
        .filter((i) => i.gradedategraded)
        .sort((a, b) => b.gradedategraded! - a.gradedategraded!)[0];
    return {
        curso,
        direccion,
        total: gradeOf(items.find((i) => i.itemtype === "course")),
        conNota: graded.length,
        items: items.filter(isActivity).length,
        ultimaNota: latest && {
            nombre: nameOf(latest),
            nota: gradeOf(latest),
            fecha: isoDate(latest.gradedategraded!),
        },
    };
}

async function courseGrades(session: AulaSession, course: Course) {
    const curso = cleanName(course.fullname);
    let items: GradeItem[];
    try {
        items = await getGradeItems(session, course.id);
    } catch (e) {
        if (isHidden(e)) return { curso, notasOcultas: true, aviso: HIDDEN };
        throw e;
    }
    let cut = false;
    const view = (i: GradeItem) => {
        const feedback = richText(session.site, i.feedback);
        const long = feedback.length > FEEDBACK_CHARS;
        cut ||= long;
        return {
            nombre: nameOf(i),
            tipo: typeOf(i),
            nota: gradeOf(i),
            rango: rangeOf(i),
            porcentaje: percentOf(i),
            oculta: i.gradeishidden || undefined,
            fecha: gradeOf(i) && i.gradedategraded ? isoDate(i.gradedategraded) : undefined,
            devolucion: (long ? `${feedback.slice(0, FEEDBACK_CHARS)}…` : feedback) || undefined,
            direccion: i.cmid ? moduleAddr(course.id, i.cmid) : undefined,
        };
    };
    const total = items.find((i) => i.itemtype === "course");
    return {
        curso,
        total: total && { nota: gradeOf(total), rango: rangeOf(total), porcentaje: percentOf(total) },
        items: items.filter((i) => i.itemtype !== "course").map(view),
        recortado: cut || undefined,
        aviso: cut
            ? "Alguna devolución está recortada: la completa está al abrir la actividad con su `direccion`."
            : undefined,
    };
}

/** Actividades e ítems cargados a mano: lo que se califica, sin los totales de categoría y del curso. */
const isActivity = (i: GradeItem) => i.itemtype === "mod" || i.itemtype === "manual";

/** La nota, salvo que todavía no esté o que el docente la oculte. */
function gradeOf(i: GradeItem | undefined): string | undefined {
    if (!i || i.gradeishidden || !i.gradeformatted || i.gradeformatted === NO_GRADE) return undefined;
    return i.gradeformatted;
}

/** Moodle lo manda con entidades: "0&ndash;10". */
const rangeOf = (i: GradeItem) => (i.rangeformatted && htmlToText(i.rangeformatted)) || undefined;

const percentOf = (i: GradeItem) =>
    gradeOf(i) && i.percentageformatted !== NO_GRADE ? i.percentageformatted || undefined : undefined;

function typeOf(i: GradeItem): string {
    if (i.itemtype === "mod") return i.itemmodule ?? "actividad";
    if (i.itemtype === "category") return "categoria";
    return i.itemtype;
}

function nameOf(i: GradeItem): string | undefined {
    return cleanName(htmlToText(i.itemname ?? "")) || (i.itemtype === "category" ? "Categoría" : undefined);
}
