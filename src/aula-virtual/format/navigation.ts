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
import type { AulaSite } from "../../shared/campus.js";
import type { AulaSession } from "../client/session.js";
import type { CourseModule, CourseSection, ForumPost } from "../client/types.js";
import { viewChoice, viewChoicegroup, viewQuiz, viewSubmission } from "./activities.js";
import { cleanName, isoDate, richText, safeLink, toFile, toFileSummary } from "./fields.js";
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

/** Etiquetas enteras primero, cortadas si así no entra: el texto de una etiqueta es todo su contenido. */
const LABEL_MODES = [true, false];

const fits = (value: unknown) => JSON.stringify(value).length <= BUDGET_CHARS;

/**
 * Mapa del curso: secciones y módulos con descripciones recortadas. Si no entra en el presupuesto, va un
 * índice de secciones y cada una se abre aparte. El índice sale de la misma descarga: pedir las secciones
 * sin módulos (`excludemodules`) igual pesa megas y no dice cuántos módulos tiene cada una.
 */
async function viewCourse(session: AulaSession, courseId: number) {
    const sections = (await getCourseSections(session, courseId))
        .filter((s) => s.uservisible !== false)
        .filter((s) => htmlToText(s.summary) || visibleModules(s).length > 0);

    for (const labelsInFull of LABEL_MODES) {
        const secciones = sections.map((s) => ({
            ...sectionHeader(s, courseId),
            resumen: richText(session.site, s.summary) || undefined,
            modulos: visibleModules(s).map((m) => toModule(m, courseId, session.site, { labelsInFull })),
        }));
        if (!fits(secciones)) continue;
        if (labelsInFull) return { secciones };
        return {
            secciones,
            recortado: true,
            aviso:
                "Para que el curso entre en una respuesta, las etiquetas vinieron resumidas (las cortadas " +
                "terminan en …). Abrí la sección con su `direccion` para leerlas enteras.",
        };
    }

    const index = sections.map((s) => {
        const modules = visibleModules(s);
        const activities = modules.filter((m) => !CONTENT_TYPES.has(m.modname));
        return {
            ...sectionHeader(s, courseId),
            resumen: htmlToSnippet(s.summary) || undefined,
            modulos: modules.length,
            tipos: modules.length ? countTypes(modules) : undefined,
            actividades: activities.length
                ? activities.map((m) => ({
                      direccion: moduleAddr(courseId, m.id),
                      nombre: cleanName(m.name),
                      tipo: m.modname,
                  }))
                : undefined,
        };
    });
    if (fits(index)) {
        return {
            indice:
                "El curso entero no entra en una respuesta, así que vino como índice. Abrí la sección que " +
                "necesites con su `direccion`.",
            secciones: index,
        };
    }
    const kept = withinBudget(index, OMITTED_RESERVE_CHARS);
    // Ni el índice entra: de las secciones que faltan va solo la dirección, que alcanza para abrirlas.
    const omitted = listOmitted(sections.slice(kept.length).map((s) => sectionAddr(courseId, s.section)));
    return {
        indice:
            "El curso entero no entra en una respuesta, así que vino como índice, y ni así entra: faltan las " +
            `últimas ${omitted.total} secciones. Las primeras están en \`seccionesOmitidas\`; ` +
            "para el resto, buscá con aula_search en este curso.",
        secciones: kept,
        recortado: true,
        seccionesOmitidas: omitted.listed,
        otrasOmitidas: omitted.rest,
    };
}

/** Cuántos de los omitidos se nombran: la lista no puede volver a pasarse del presupuesto. */
const MAX_OMITTED_LISTED = 20;
/** Lo que se aparta del presupuesto para esa lista: unos 90 caracteres por módulo. */
const OMITTED_RESERVE_CHARS = 2_000;

/** Los primeros omitidos y cuántos más hay ("y X más"), para la respuesta. */
function listOmitted<T>(items: T[]) {
    const rest = items.length - MAX_OMITTED_LISTED;
    return { total: items.length, listed: items.slice(0, MAX_OMITTED_LISTED), rest: rest > 0 ? rest : undefined };
}

/** Los primeros elementos que entran en el presupuesto, contando lo que ya se gastó en la respuesta. */
function withinBudget<T>(items: T[], spent = 0): T[] {
    let kept = 0;
    for (const item of items) {
        spent += JSON.stringify(item).length + 1;
        if (spent > BUDGET_CHARS) break;
        kept++;
    }
    return items.slice(0, kept);
}

/**
 * Tipos de módulo que son material y no algo para hacer. El índice nombra solo el resto (foros, tareas,
 * cuestionarios): nombrar también el material lo multiplica por cinco en un curso grande.
 */
const CONTENT_TYPES = new Set(["label", "resource", "url", "folder", "page"]);

/**
 * Una sección con todos sus módulos. Si no entra en el presupuesto, primero se cortan las etiquetas y, si
 * ni así entra, los últimos módulos.
 */
async function viewSection(session: AulaSession, courseId: number, sectionNumber: number) {
    const sections = await getCourseSections(session, courseId, { sectionNumber });
    const section = sections.find((s) => s.section === sectionNumber);
    if (!section || section.uservisible === false) {
        throw new Error(
            `No existe la sección ${sectionNumber} en el curso ${courseId}, o no tenés acceso. ` +
                `Abrí "${courseAddr(courseId)}" para ver sus secciones.`,
        );
    }

    const seccion = { ...sectionHeader(section, courseId), resumen: richText(session.site, section.summary) || undefined };
    const map = (labelsInFull: boolean) =>
        visibleModules(section).map((m) => toModule(m, courseId, session.site, { labelsInFull }));
    const withFullLabels = map(true);
    if (fits({ seccion, modulos: withFullLabels })) return { seccion, modulos: withFullLabels };

    const modules = map(false);
    if (fits({ seccion, modulos: modules })) {
        return {
            seccion,
            modulos: modules,
            recortado: true,
            aviso:
                "Para que la sección entre en una respuesta, las etiquetas vinieron resumidas (las cortadas " +
                "terminan en …). Abrí la etiqueta con su `direccion` para leerla entera.",
        };
    }
    const kept = withinBudget(modules, JSON.stringify(seccion).length + OMITTED_RESERVE_CHARS);
    const omitted = listOmitted(
        visibleModules(section)
            .slice(kept.length)
            .map((m) => ({
                direccion: moduleAddr(courseId, m.id),
                nombre: m.modname === "label" ? undefined : cleanName(m.name),
                tipo: m.modname,
            })),
    );
    return {
        seccion,
        modulos: kept,
        recortado: true,
        aviso:
            "La sección no entra en una respuesta: las etiquetas vinieron resumidas (terminan en …) y faltan " +
            `los últimos ${omitted.total} módulos. Los primeros están en \`modulosOmitidos\`, para abrir ` +
            `con su \`direccion\`${omitted.rest ? `; para los otros ${omitted.rest}, buscá con aula_search en este curso` : ""}.`,
        modulosOmitidos: omitted.listed,
        otrosOmitidos: omitted.rest,
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
    const base = { seccion: cleanName(sectionName), modulo: toModule(module, address.courseId, session.site) };
    switch (module.modname) {
        case "forum":
            return { ...base, ...(await viewForum(session, address, module.instance, page)) };
        case "assign":
            return { ...base, entrega: await viewSubmission(session, address.courseId, module) };
        case "choice":
            return { ...base, eleccion: await viewChoice(session, address.courseId, module) };
        case "choicegroup":
            return { ...base, eleccion: await viewChoicegroup(session, module) };
        case "quiz":
            return { ...base, cuestionario: await viewQuiz(session, address.courseId, module) };
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
            mensaje: richText(session.site, p.message),
            adjuntos: attachmentsOf(p),
            // Qué acciones permite cada publicación, para no intentar lo que Moodle rechazaría.
            acciones: allowedActions(p.capabilities),
        })),
    };
}

/** Los adjuntos de una publicación, con la URL donde la deja `mod_forum_get_discussion_posts`. */
function attachmentsOf(p: ForumPost) {
    const files = (p.attachments ?? []).flatMap((a) => {
        const fileurl = a.fileurl ?? a.url;
        return fileurl ? [toFile({ ...a, fileurl })] : [];
    });
    return files.length ? files : undefined;
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
 * Con `map` el módulo va adelgazado para los mapas de curso y de sección: sin `id` ni `url`, que ya cubre la
 * `direccion`, sin el nombre de las etiquetas, que repite su texto, con la descripción recortada (la de las
 * etiquetas, solo si no van `labelsInFull`) y con los archivos reducidos a lo que pide aula_read_file. Lo
 * demás aparece al abrir el módulo.
 */
function toModule(m: CourseModule, courseId: number, site: AulaSite, map?: { labelsInFull: boolean }) {
    const contents = m.contents ?? [];
    const files = contents.filter((c) => c.type === "file");
    const links = contents.filter((c) => c.type === "url");
    const isLabel = m.modname === "label";
    const fullDescription = !map || (isLabel && map.labelsInFull);
    return {
        direccion: moduleAddr(courseId, m.id),
        id: map ? undefined : m.id,
        nombre: map && isLabel ? undefined : cleanName(m.name),
        tipo: m.modname,
        url: map || !m.url ? undefined : safeLink(site, m.url),
        descripcion: (fullDescription ? richText(site, m.description) : htmlToSnippet(m.description)) || undefined,
        restriccion: htmlToText(m.availabilityinfo) || undefined,
        fechas: m.dates?.length
            ? m.dates.map((d) => ({ etiqueta: d.label, fecha: isoDate(d.timestamp) }))
            : undefined,
        archivos: files.length ? files.map(map ? toFileSummary : toFile) : undefined,
        enlaces: links.length ? links.map((l) => safeLink(site, l.fileurl)).filter(Boolean) : undefined,
    };
}
