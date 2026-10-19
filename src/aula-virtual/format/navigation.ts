import { htmlToSnippet, htmlToText } from "../../shared/html.js";
import {
    courseAddr,
    discussionAddr,
    formatAddress,
    moduleAddr,
    parentOf,
    parseAddress,
    sectionAddr,
    type Address,
} from "./address.js";
import {
    canAddDiscussion,
    getCourseSections,
    getDiscussionPosts,
    getForumDiscussions,
    getUserCourses,
    PAGE_SIZE,
} from "../client/moodle.js";
import type { AulaSession } from "../client/session.js";
import type { CourseModule, CourseSection } from "../client/types.js";
import { viewChoice, viewChoicegroup, viewSubmission } from "./activities.js";
import { cleanName, isoDate, toFile, toFileSummary } from "./fields.js";
import { BUDGET_CHARS } from "./files.js";

type ModuleAddress = Extract<Address, { level: "module" }>;

/**
 * Abre una dirección del aula y devuelve lo que hay, su padre y las direcciones de su contenido. Acá, y
 * solo acá, se decide qué ve el modelo y cuánto texto le cuesta.
 */
export async function open(session: AulaSession, rawAddress: string, page = 0) {
    const address = parseAddress(rawAddress);
    const base = { direccion: formatAddress(address), padre: parentOf(address) };

    switch (address.level) {
        case "root":
            return { ...base, cursos: await viewCourses(session) };

        case "course":
            return { ...base, ...(await viewCourse(session, address.courseId)) };

        case "section":
            return { ...base, ...(await viewSection(session, address.courseId, address.section)) };

        case "module":
            return { ...base, ...(await viewModule(session, address, page)) };

        case "discussion":
            return { ...base, ...(await viewDiscussion(session, address.discussionId)) };
    }
}

async function viewCourses(session: AulaSession) {
    const courses = await getUserCourses(session);
    return courses.map((c) => ({
        direccion: courseAddr(c.id),
        id: c.id,
        nombre: c.fullname,
        nombreCorto: c.shortname,
        visible: c.visible === 1,
        progreso: c.progress ?? null,
        ultimoAcceso: isoDate(c.lastaccess),
    }));
}

/**
 * Mapa del curso: secciones y módulos con descripciones recortadas. Si no entra en el presupuesto, va un
 * índice de secciones y cada una se abre aparte. El índice sale de la misma descarga: pedir las secciones
 * sin módulos (`excludemodules`) igual pesa megas y no dice cuántos módulos tiene cada una.
 */
async function viewCourse(session: AulaSession, courseId: number) {
    const sections = (await getCourseSections(session, courseId))
        .filter((s) => s.uservisible !== false)
        .filter((s) => htmlToText(s.summary) || visibleModules(s).length > 0);

    const secciones = sections.map((s) => ({
        ...sectionHeader(s, courseId),
        resumen: htmlToText(s.summary) || undefined,
        modulos: visibleModules(s).map((m) => toModule(m, courseId, true)),
    }));
    if (JSON.stringify(secciones).length <= BUDGET_CHARS) return { secciones };

    return {
        indice:
            "El curso entero no entra en una respuesta, así que vino como índice. Abrí la sección que " +
            "necesites con su `direccion`.",
        secciones: sections.map((s) => {
            const modules = visibleModules(s);
            return {
                ...sectionHeader(s, courseId),
                resumen: htmlToSnippet(s.summary) || undefined,
                modulos: modules.length,
                tipos: modules.length ? countTypes(modules) : undefined,
            };
        }),
    };
}

/** Una sección con todos sus módulos. Si ni así entra en el presupuesto, se cortan los últimos. */
async function viewSection(session: AulaSession, courseId: number, sectionNumber: number) {
    const sections = await getCourseSections(session, courseId, { sectionNumber });
    const section = sections.find((s) => s.section === sectionNumber);
    if (!section || section.uservisible === false) {
        throw new Error(
            `No existe la sección ${sectionNumber} en el curso ${courseId}, o no tenés acceso. ` +
                `Abrí "${courseAddr(courseId)}" para ver sus secciones.`,
        );
    }

    const seccion = { ...sectionHeader(section, courseId), resumen: htmlToText(section.summary) || undefined };
    const modules = visibleModules(section).map((m) => toModule(m, courseId, true));
    let spent = JSON.stringify(seccion).length;
    let kept = 0;
    for (const m of modules) {
        spent += JSON.stringify(m).length + 1;
        if (spent > BUDGET_CHARS) break;
        kept++;
    }
    const omitted = modules.length - kept;
    return {
        seccion,
        modulos: modules.slice(0, kept),
        recortado: omitted > 0 || undefined,
        modulosOmitidos: omitted || undefined,
    };
}

function sectionHeader(s: CourseSection, courseId: number) {
    return {
        direccion: sectionAddr(courseId, s.section),
        nombre: cleanName(s.name),
        numero: s.section,
        restriccion: htmlToText(s.availabilityinfo) || undefined,
    };
}

const visibleModules = (s: CourseSection) => s.modules.filter((m) => m.uservisible);

/** Cuántos módulos hay de cada tipo, para ver de un vistazo dónde hay tareas, foros o recursos. */
function countTypes(modules: CourseModule[]) {
    const types: Record<string, number> = {};
    for (const m of modules) types[m.modname] = (types[m.modname] ?? 0) + 1;
    return types;
}

async function viewModule(session: AulaSession, address: ModuleAddress, page: number) {
    const { sectionName, module } = await findModule(session, address.courseId, address.cmid);
    const base = { seccion: cleanName(sectionName), modulo: toModule(module, address.courseId) };
    switch (module.modname) {
        case "forum":
            return { ...base, ...(await viewForum(session, address, module.instance, page)) };
        case "assign":
            return { ...base, entrega: await viewSubmission(session, address.courseId, module) };
        case "choice":
            return { ...base, eleccion: await viewChoice(session, address.courseId, module) };
        case "choicegroup":
            return { ...base, eleccion: await viewChoicegroup(session, module) };
        default:
            return base;
    }
}

/**
 * Un foro se muestra como índice: asunto y un fragmento de cada discusión. El texto entero aparece al
 * abrirla.
 */
async function viewForum(session: AulaSession, address: ModuleAddress, forumid: number, page: number) {
    const [{ discussions }, canStartDiscussion] = await Promise.all([
        getForumDiscussions(session, forumid, page),
        canAddDiscussion(session, forumid),
    ]);
    return {
        puedeAbrirHilo: canStartDiscussion,
        discusiones: discussions.map((d) => ({
            direccion: discussionAddr(address.courseId, address.cmid, d.discussion),
            asunto: d.subject,
            autor: d.userfullname,
            autorId: d.userid,
            fecha: isoDate(d.created),
            ultimaActividad: isoDate(d.timemodified),
            respuestas: d.numreplies,
            fijada: d.pinned || undefined,
            adjuntos: d.attachment || undefined,
            resumen: htmlToSnippet(d.message),
        })),
        pagina: page,
        hayMasDiscusiones: discussions.length === PAGE_SIZE || undefined,
    };
}

async function viewDiscussion(session: AulaSession, discussionId: number) {
    const { posts } = await getDiscussionPosts(session, discussionId);
    const visible = posts.filter((p) => !p.isdeleted);
    return {
        asunto: visible[0]?.subject,
        publicaciones: visible.map((p) => ({
            autor: p.author.fullname,
            autorId: p.author.id,
            fecha: isoDate(p.timecreated),
            respuestaA: p.parentid ?? undefined,
            id: p.id,
            mensaje: htmlToText(p.message),
            adjuntos: p.attachments.length ? p.attachments.map(toFile) : undefined,
            // Qué acciones permite cada publicación, para no intentar lo que Moodle rechazaría.
            acciones: allowedActions(p.capabilities),
        })),
    };
}

function allowedActions(c: { reply: boolean; edit: boolean; delete: boolean }) {
    const allowed = [c.reply && "responder", c.edit && "editar", c.delete && "borrar"].filter(Boolean);
    return allowed.length ? allowed : undefined;
}

/** Busca un módulo por cmid y devuelve también la sección que lo contiene. */
export async function findModule(
    session: AulaSession,
    courseId: number,
    cmid: number,
): Promise<{ sectionName: string; module: CourseModule }> {
    const sections: CourseSection[] = await getCourseSections(session, courseId, { cmid });
    for (const section of sections) {
        const module = section.modules.find((m) => m.id === cmid);
        if (!module) continue;
        if (!module.uservisible) throw new Error(`No tenés acceso al módulo ${cmid}.`);
        return { sectionName: section.name, module };
    }
    throw new Error(`No existe el módulo ${cmid} en el curso ${courseId}.`);
}

/**
 * Con `summarized` el módulo va adelgazado para los mapas de curso y de sección: sin `id` ni `url`, que ya
 * cubre la `direccion`, sin el nombre de las etiquetas, que repite su texto, y con los archivos reducidos a
 * lo que pide aula_read_file. Lo demás aparece al abrir el módulo.
 */
function toModule(m: CourseModule, courseId: number, summarized = false) {
    const contents = m.contents ?? [];
    const files = contents.filter((c) => c.type === "file");
    const links = contents.filter((c) => c.type === "url");
    return {
        direccion: moduleAddr(courseId, m.id),
        id: summarized ? undefined : m.id,
        nombre: summarized && m.modname === "label" ? undefined : cleanName(m.name),
        tipo: m.modname,
        url: summarized ? undefined : m.url,
        descripcion: (summarized ? htmlToSnippet(m.description) : htmlToText(m.description)) || undefined,
        restriccion: htmlToText(m.availabilityinfo) || undefined,
        fechas: m.dates?.length
            ? m.dates.map((d) => ({ etiqueta: d.label, fecha: isoDate(d.timestamp) }))
            : undefined,
        archivos: files.length ? files.map(summarized ? toFileSummary : toFile) : undefined,
        enlaces: links.length ? links.map((l) => l.fileurl) : undefined,
    };
}
