import { getActionEvents, getCalendarEvents, getUserCourses, TIMELINE_PAGE_SIZE } from "../client/moodle.js";
import type { AulaSession } from "../client/session.js";
import type { ActionEvent, CalendarEvent } from "../client/types.js";
import { courseAddr, courseOf, moduleAddr } from "./address.js";
import { cleanName, isoDate, richText } from "./fields.js";

const DAY_SECONDS = 86_400;
/** Rango por defecto, en días: las próximas dos semanas. */
export const DEFAULT_DAYS = 14;
export const MAX_DAYS = 120;
/**
 * Días hacia atrás para los pendientes: lo vencido que Moodle sigue mostrando como "por hacer" porque la
 * tarea todavía acepta entregas tarde.
 */
const OVERDUE_DAYS = 14;
/** Páginas de la línea de tiempo, de 50 pendientes cada una. */
const MAX_TIMELINE_PAGES = 4;
/** Eventos que no son pendientes (aperturas, clases, eventos del curso); con más, se pide acortar el rango. */
const MAX_EVENTS = 60;

/** Los eventos que no son de una actividad, con el nombre que les da el aula. */
const EVENT_TYPES: Record<string, string> = {
    user: "personal",
    course: "curso",
    group: "grupo",
    site: "sitio",
    category: "categoria",
};

/**
 * Lo que viene en el aula: los pendientes de la línea de tiempo (entregas, cierres de cuestionarios) y el
 * resto de los eventos del calendario en el rango. `now` se inyecta en los tests.
 */
export async function upcoming(
    session: AulaSession,
    options: { days?: number; course?: string } = {},
    now = new Date(),
) {
    const days = Math.min(Math.max(options.days ?? DEFAULT_DAYS, 1), MAX_DAYS);
    const courseId = options.course ? courseOf(options.course) : undefined;
    const today = Math.floor(now.getTime() / 1000);
    const until = today + days * DAY_SECONDS;

    const courses = await getUserCourses(session);
    const names = new Map(courses.map((c) => [c.id, cleanName(c.fullname)]));
    if (courseId !== undefined && !names.has(courseId)) {
        throw new Error(`No estás inscripto en el curso ${courseId}. Las direcciones salen de aula_list_courses.`);
    }

    const [timeline, calendar] = await Promise.all([
        timelineEvents(session, today - OVERDUE_DAYS * DAY_SECONDS, until),
        getCalendarEvents(session, courseId !== undefined ? [courseId] : [...names.keys()], today, until),
    ]);

    const pending = timeline.events.filter((e) => courseId === undefined || e.course.id === courseId);
    // Los dos salen de la misma tabla de eventos: un vencimiento pendiente queda solo en `pendientes`.
    const pendingIds = new Set(pending.map((e) => e.id));
    const others = calendar
        .filter((e) => !pendingIds.has(e.id) && e.timestart >= today)
        .sort((a, b) => a.timestart - b.timestart);
    const shown = others.slice(0, MAX_EVENTS);

    const cut = timeline.more || shown.length < others.length;
    return {
        desde: isoDate(today),
        hasta: isoDate(until),
        pendientes: pending.map((e) => viewPending(e, today)),
        eventos: shown.length ? shown.map((e) => viewEvent(session, e, names)) : undefined,
        recortado: cut || undefined,
        aviso: cut
            ? `Hay más de lo que entra en una respuesta (${pending.length} pendientes y ${others.length} eventos). ` +
              "Pedí menos `dias` o filtrá por `curso`."
            : undefined,
    };
}

/** La línea de tiempo viene de a 50: se pide hasta juntar todo o llegar al tope de páginas. */
async function timelineEvents(session: AulaSession, from: number, to: number) {
    const events: ActionEvent[] = [];
    for (let page = 0; page < MAX_TIMELINE_PAGES; page++) {
        const { events: batch } = await getActionEvents(session, from, to, events.at(-1)?.id);
        events.push(...batch);
        if (batch.length < TIMELINE_PAGE_SIZE) return { events, more: false };
    }
    return { events, more: true };
}

function viewPending(e: ActionEvent, today: number) {
    const cmid = cmidOf(e.url);
    return {
        nombre: cleanName(e.name),
        curso: cleanName(e.course.fullname),
        tipo: e.modulename,
        fecha: isoDate(e.timesort),
        vencida: e.timesort < today || undefined,
        // Por ejemplo, un cuestionario que todavía no abrió o que ya no admite intentos. Moodle igual
        // manda el texto del botón ("Intente resolver el cuestionario ahora"), que ahí confunde.
        disponible: e.action?.actionable === false ? false : undefined,
        accion: (e.action?.actionable && e.action.name) || undefined,
        direccion: cmid ? moduleAddr(e.course.id, cmid) : courseAddr(e.course.id),
    };
}

function viewEvent(session: AulaSession, e: CalendarEvent, names: Map<number, string>) {
    const curso = names.get(e.courseid);
    return {
        nombre: cleanName(e.name),
        curso,
        tipo: e.modulename || EVENT_TYPES[e.eventtype] || e.eventtype,
        inicio: isoDate(e.timestart),
        duracionMinutos: e.timeduration ? Math.round(e.timeduration / 60) : undefined,
        // El detalle de una actividad está al abrirla; el de un evento del curso o personal, solo acá.
        detalle: (!e.modulename && richText(session.site, e.description)) || undefined,
        direccion: curso ? courseAddr(e.courseid) : undefined,
    };
}

/** El cmid sale de la URL de la actividad: los eventos traen la instancia, no el módulo. */
function cmidOf(url: string | undefined): number | undefined {
    const m = url?.match(/\/mod\/\w+\/view\.php\?id=(\d+)/);
    return m ? Number(m[1]) : undefined;
}
