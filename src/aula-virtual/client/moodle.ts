import { randomInt } from "node:crypto";
import type { AulaSite } from "../../shared/campus.js";
import { USER_AGENT } from "../../shared/http.js";
import { callWs, MoodleError, WRITE } from "./web-service.js";
import type { AulaSession } from "./session.js";
import type {
    ActionEvent,
    Assignment,
    AssignSubmissionStatus,
    CalendarEvent,
    Choice,
    ChoiceOption,
    Conversation,
    Course,
    CourseSection,
    CourseUpdates,
    ForumDiscussion,
    ForumPost,
    GradeItem,
    ModuleInfo,
    PublicConfig,
    Quiz,
    QuizAttempt,
    Message,
    MessageMember,
    SiteInfo,
} from "./types.js";

/** La configuración pública del aula, sin token: la que pide la app de Moodle antes de entrar. */
export async function getPublicConfig(site: AulaSite): Promise<PublicConfig> {
    const res = await fetch(`${site.baseUrl}/lib/ajax/service-nologin.php?info=tool_mobile_get_public_config`, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": USER_AGENT },
        body: JSON.stringify([{ index: 0, methodname: "tool_mobile_get_public_config", args: {} }]),
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new MoodleError(`HTTP ${res.status}`);
    const [result] = (await res.json()) as { error: boolean; data?: PublicConfig; exception?: { message: string } }[];
    if (result?.error || !result?.data) throw new MoodleError(result?.exception?.message ?? "respuesta inesperada");
    return result.data;
}

/**
 * site_info de cada sesión, con el token que lo pidió: casi todas las funciones necesitan el `userid` y
 * no cambia mientras el token sea el mismo. Con otro token puede ser otro usuario, así que se vuelve a pedir.
 */
const siteInfos = new WeakMap<AulaSession, { token: string; info: Promise<SiteInfo> }>();

export async function getSiteInfo(session: AulaSession): Promise<SiteInfo> {
    const token = await session.getToken();
    const cached = siteInfos.get(session);
    if (cached?.token === token) return cached.info;

    const info = callWs<SiteInfo>(session, "core_webservice_get_site_info");
    siteInfos.set(session, { token, info });
    // Un error no queda guardado: la próxima llamada lo vuelve a intentar.
    info.catch(() => {
        if (siteInfos.get(session)?.info === info) siteInfos.delete(session);
    });
    return info;
}

/** Dueño del token con su email institucional, que site_info no incluye. */
export async function getOwnUser(session: AulaSession): Promise<{ username: string; email: string | null }> {
    const { userid, username } = await getSiteInfo(session);
    const [user] = await callWs<{ email?: string }[]>(session, "core_user_get_users_by_field", {
        field: "id",
        "values[0]": userid,
    });
    return { username, email: user?.email || null };
}

export async function getUserCourses(session: AulaSession): Promise<Course[]> {
    const { userid } = await getSiteInfo(session);
    return callWs<Course[]>(session, "core_enrol_get_users_courses", { userid });
}

/**
 * El libro de calificaciones del usuario en un curso. Si el docente lo oculta, Moodle responde
 * `nopermissiontoviewgrades`.
 */
export async function getGradeItems(session: AulaSession, courseid: number): Promise<GradeItem[]> {
    const { userid } = await getSiteInfo(session);
    const { usergrades } = await callWs<{ usergrades: { gradeitems: GradeItem[] }[] }>(
        session,
        "gradereport_user_get_grade_items",
        { courseid, userid },
    );
    return usergrades[0]?.gradeitems ?? [];
}

/** Lo que cambió en un curso desde `since` (segundos): solo lo que el usuario puede ver. */
export function getUpdatesSince(session: AulaSession, courseid: number, since: number): Promise<CourseUpdates> {
    return callWs<CourseUpdates>(session, "core_course_get_updates_since", { courseid, since });
}

/** Nombre y tipo de un módulo, sin cargar el contenido del curso (que puede pesar megas). */
export async function getCourseModule(session: AulaSession, cmid: number): Promise<ModuleInfo> {
    const { cm } = await callWs<{ cm: ModuleInfo }>(session, "core_course_get_course_module", { cmid });
    return cm;
}

/**
 * Secciones y módulos de un curso. Si se pasa `cmid`, Moodle trae todas las secciones pero completa
 * solo ese módulo: alcanza para abrir uno sin cargar el curso completo. Con `sectionNumber` trae solo esa
 * sección, mucho más rápido que el curso entero (0,4 s contra 7 s en un curso de 378 módulos).
 */
export function getCourseSections(
    session: AulaSession,
    courseId: number,
    filter: { cmid?: number; sectionNumber?: number } = {},
): Promise<CourseSection[]> {
    const params: Record<string, string | number> = { courseid: courseId };
    const options: [string, number | undefined][] = [
        ["cmid", filter.cmid],
        ["sectionnumber", filter.sectionNumber],
    ];
    let i = 0;
    for (const [name, value] of options) {
        if (value === undefined) continue;
        params[`options[${i}][name]`] = name;
        params[`options[${i}][value]`] = value;
        i++;
    }
    return callWs<CourseSection[]>(session, "core_course_get_contents", params);
}

// --- Foros ---

/** Tamaño de página del índice de discusiones. */
export const PAGE_SIZE = 50;

/**
 * Discusiones de un foro, de la más nueva a la más vieja. Cada una trae entera su primera publicación;
 * recortarla le toca a quien la muestra.
 */
export function getForumDiscussions(
    session: AulaSession,
    forumid: number,
    page = 0,
): Promise<{ discussions: ForumDiscussion[] }> {
    return callWs(session, "mod_forum_get_forum_discussions", { forumid, page, perpage: PAGE_SIZE });
}

/** Todas las publicaciones de una discusión, con las respuestas. */
export function getDiscussionPosts(session: AulaSession, discussionid: number): Promise<{ posts: ForumPost[] }> {
    return callWs(session, "mod_forum_get_discussion_posts", { discussionid });
}

/** Indica si el usuario puede abrir hilos en el foro y en qué grupo. */
export async function canAddDiscussion(session: AulaSession, forumid: number): Promise<boolean> {
    const { status } = await callWs<{ status: boolean }>(session, "mod_forum_can_add_discussion", { forumid });
    return status;
}

/** Abre un hilo; en foros por grupos, Moodle asigna el del usuario. */
export async function addDiscussion(
    session: AulaSession,
    forumid: number,
    subject: string,
    message: string,
): Promise<number> {
    const { discussionid } = await callWs<{ discussionid: number }>(session, "mod_forum_add_discussion", {
        forumid,
        subject,
        message,
    }, WRITE);
    return discussionid;
}

/** Contesta una publicación (también la primera de la discusión). */
export async function addDiscussionPost(
    session: AulaSession,
    postid: number,
    subject: string,
    message: string,
): Promise<number> {
    const { postid: newPostId } = await callWs<{ postid: number }>(session, "mod_forum_add_discussion_post", {
        postid,
        subject,
        message,
    }, WRITE);
    return newPostId;
}

/** Edita una publicación del usuario; si el asunto va vacío, Moodle conserva el anterior. */
export async function updateDiscussionPost(
    session: AulaSession,
    postid: number,
    subject: string,
    message: string,
): Promise<void> {
    const result = await callWs<WriteResult>(
        session,
        "mod_forum_update_discussion_post",
        { postid, subject, message },
        WRITE,
    );
    requireDone(result, "Moodle no editó la publicación.");
}

/** Borra una publicación; borrar la primera elimina la discusión. */
export async function deletePost(session: AulaSession, postid: number): Promise<void> {
    const result = await callWs<WriteResult>(session, "mod_forum_delete_post", { postid }, WRITE);
    requireDone(result, "Moodle no borró la publicación.");
}

// --- Tareas ---

/** Tareas del curso con su configuración: fechas y tipos de entrega admitidos. */
export async function getAssignments(session: AulaSession, courseId: number): Promise<Assignment[]> {
    const { courses } = await callWs<{ courses: { assignments: Assignment[] }[] }>(
        session,
        "mod_assign_get_assignments",
        { "courseids[0]": courseId },
    );
    return courses[0]?.assignments ?? [];
}

/** Cómo está la entrega del usuario y, si ya hay corrección, la devolución. */
export function getSubmissionStatus(session: AulaSession, assignid: number): Promise<AssignSubmissionStatus> {
    return callWs(session, "mod_assign_get_submission_status", { assignid });
}

/**
 * `itemid` de un borrador sin archivos, para vaciar un área. `core_files_get_unused_draft_itemid` existe
 * desde Moodle 3.11 (UNJu tiene 3.9); sin ella se elige uno al azar, como hace el propio Moodle en
 * `file_get_unused_draft_itemid`: los borradores son del usuario y uno sin usar está vacío.
 */
export async function getUnusedDraftItemId(session: AulaSession): Promise<number> {
    const { functions } = await getSiteInfo(session);
    if (!functions?.some((f) => f.name === "core_files_get_unused_draft_itemid")) return randomInt(1, 1_000_000_000);
    const { itemid } = await callWs<{ itemid: number }>(session, "core_files_get_unused_draft_itemid");
    return itemid;
}

/** Cuando Moodle no guarda o no envía no lanza error: lo avisa en `warnings`. */
function throwOnWarnings(warnings: { message: string }[] | undefined, fallback: string) {
    if (warnings?.length) throw new MoodleError(warnings.map((w) => w.message).join(" ") || fallback);
}

/** Respuesta de las escrituras que, en lugar de fallar, contestan `status: false` o con `warnings`. */
interface WriteResult {
    status?: boolean;
    warnings?: { message: string }[];
}

/** Falla si Moodle no hizo el cambio, con su motivo o con `fallback`. */
function requireDone(result: WriteResult | null, fallback: string) {
    throwOnWarnings(result?.warnings, fallback);
    if (result?.status === false) throw new MoodleError(fallback);
}

/**
 * Guarda la entrega. Cada plugin activo pisa su contenido con lo que recibe: el de archivos se queda
 * con todo el borrador `filesItemId` y el de texto, con `text`.
 */
export async function saveSubmission(
    session: AulaSession,
    assignmentid: number,
    data: { filesItemId?: number; text?: { html: string; format: number; itemid: number } },
): Promise<void> {
    const params: Record<string, string | number> = { assignmentid };
    if (data.filesItemId !== undefined) params["plugindata[files_filemanager]"] = data.filesItemId;
    if (data.text) {
        params["plugindata[onlinetext_editor][text]"] = data.text.html;
        params["plugindata[onlinetext_editor][format]"] = data.text.format;
        params["plugindata[onlinetext_editor][itemid]"] = data.text.itemid;
    }
    const warnings = await callWs<{ message: string }[]>(session, "mod_assign_save_submission", params, WRITE);
    throwOnWarnings(warnings, "Moodle no guardó la entrega.");
}

/** Confirma el envío del borrador; a partir de ahí no se puede editar. */
export async function submitForGrading(
    session: AulaSession,
    assignmentid: number,
    acceptStatement: boolean,
): Promise<void> {
    const warnings = await callWs<{ message: string }[]>(session, "mod_assign_submit_for_grading", {
        assignmentid,
        acceptsubmissionstatement: acceptStatement ? 1 : 0,
    }, WRITE);
    throwOnWarnings(warnings, "Moodle no envió la entrega.");
}

/**
 * Deja vacía la entrega del usuario (o del grupo). No hay otra manera: mod_assign_save_submission no
 * acepta una entrega sin contenido.
 */
export async function removeSubmission(session: AulaSession, assignid: number): Promise<void> {
    const { userid } = await getSiteInfo(session);
    const warnings = await callWs<{ message: string }[]>(session, "mod_assign_remove_submission", {
        userid,
        assignid,
    }, WRITE);
    throwOnWarnings(warnings, "Moodle no quitó la entrega.");
}

// --- Cuestionarios (quiz) ---
// Solo configuración e intentos: nunca preguntas, respuestas ni empezar un intento, que son decisiones
// de integridad académica.

export async function getQuizzes(session: AulaSession, courseId: number): Promise<Quiz[]> {
    const { quizzes } = await callWs<{ quizzes: Quiz[] }>(session, "mod_quiz_get_quizzes_by_courses", {
        "courseids[0]": courseId,
    });
    return quizzes;
}

/** Los intentos del usuario, terminados o no. */
export async function getQuizAttempts(session: AulaSession, quizid: number): Promise<QuizAttempt[]> {
    const { attempts } = await callWs<{ attempts: QuizAttempt[] }>(session, "mod_quiz_get_user_attempts", {
        quizid,
        status: "all",
    });
    return attempts;
}

// --- Elecciones (choice) y selección de grupos (choicegroup) ---

export async function getChoices(session: AulaSession, courseId: number): Promise<Choice[]> {
    const { choices } = await callWs<{ choices: Choice[] }>(session, "mod_choice_get_choices_by_courses", {
        "courseids[0]": courseId,
    });
    return choices;
}

export async function getChoiceOptions(session: AulaSession, choiceid: number): Promise<ChoiceOption[]> {
    const { options } = await callWs<{ options: ChoiceOption[] }>(session, "mod_choice_get_choice_options", {
        choiceid,
    });
    return options;
}

export async function submitChoiceResponse(session: AulaSession, choiceid: number, optionIds: number[]): Promise<void> {
    const params: Record<string, number> = { choiceid };
    optionIds.forEach((id, i) => (params[`responses[${i}]`] = id));
    const result = await callWs<WriteResult>(session, "mod_choice_submit_choice_response", params, WRITE);
    requireDone(result, "Moodle no guardó la respuesta.");
}

export async function deleteChoiceResponses(session: AulaSession, choiceid: number): Promise<void> {
    const result = await callWs<WriteResult>(session, "mod_choice_delete_choice_responses", { choiceid }, WRITE);
    requireDone(result, "Moodle no borró la respuesta.");
}

export async function getChoicegroupOptions(session: AulaSession, choicegroupid: number): Promise<ChoiceOption[]> {
    const { userid } = await getSiteInfo(session);
    const { options } = await callWs<{ options: ChoiceOption[] }>(session, "mod_choicegroup_get_choicegroup_options", {
        choicegroupid,
        userid,
    });
    return options;
}

/**
 * Según la actividad admita uno o varios grupos, el plugin lee `responses` o `choicegroup_<id>:
 * "true"`, y no hay forma de consultar cuál. Por eso se mandan ambas y él toma la suya. Con varios
 * grupos, los no marcados se desmarcan.
 */
export async function submitChoicegroupResponse(
    session: AulaSession,
    choicegroupid: number,
    optionIds: number[],
): Promise<void> {
    const data = [
        { name: "responses", value: String(optionIds[0]) },
        ...optionIds.map((id) => ({ name: `choicegroup_${id}`, value: "true" })),
    ];
    const params: Record<string, string | number> = { choicegroupid };
    data.forEach((d, i) => {
        params[`data[${i}][name]`] = d.name;
        params[`data[${i}][value]`] = d.value;
    });
    const result = await callWs<WriteResult>(
        session,
        "mod_choicegroup_submit_choicegroup_response",
        params,
        WRITE,
    );
    requireDone(result, "Moodle no guardó la elección de grupo.");
}

export async function deleteChoicegroupResponses(session: AulaSession, choicegroupid: number): Promise<void> {
    const result = await callWs<WriteResult>(session, "mod_choicegroup_delete_choicegroup_responses", {
        choicegroupid,
    }, WRITE);
    requireDone(result, "Moodle no borró la elección de grupo.");
}

// --- Mensajes ---

/** Nombre de otro usuario tal como lo ve el usuario logueado; null si no existe. */
export async function getMemberName(session: AulaSession, userId: number): Promise<string | null> {
    const { userid } = await getSiteInfo(session);
    let members: { id: number; fullname: string; isdeleted: boolean }[];
    try {
        members = await callWs(session, "core_message_get_member_info", {
            referenceuserid: userid,
            "userids[0]": userId,
        });
    } catch (e) {
        // Moodle 5.1 no responde vacío ante un id inexistente: falla con un error de PHP.
        if (e instanceof MoodleError) return null;
        throw e;
    }
    const m = members.find((x) => x.id === userId && !x.isdeleted);
    return m?.fullname ?? null;
}

/** Envía un mensaje privado. Si falla no lanza error: contesta `msgid: -1` con el motivo. */
export async function sendInstantMessage(session: AulaSession, touserid: number, html: string): Promise<number> {
    const [res] = await callWs<{ msgid: number; errormessage?: string }[]>(
        session,
        "core_message_send_instant_messages",
        { "messages[0][touserid]": touserid, "messages[0][text]": html, "messages[0][textformat]": 1 },
        WRITE,
    );
    if (!res || res.msgid === -1) throw new MoodleError(res?.errormessage || "Moodle no aceptó el mensaje.");
    return res.msgid;
}

// --- Calendario ---

/** Agrega un evento personal, visible solo para el usuario. */
export async function createUserEvent(
    session: AulaSession,
    event: { name: string; description: string; timestart: number; timeduration: number },
): Promise<number> {
    const { events, warnings } = await callWs<{ events: { id: number }[]; warnings?: { message: string }[] }>(
        session,
        "core_calendar_create_calendar_events",
        {
            "events[0][name]": event.name,
            "events[0][description]": event.description,
            "events[0][format]": 1,
            "events[0][eventtype]": "user",
            "events[0][timestart]": event.timestart,
            "events[0][timeduration]": event.timeduration,
        },
        WRITE,
    );
    if (!events[0]) throw new MoodleError(warnings?.map((w) => w.message).join(" ") || "Moodle no creó el evento.");
    return events[0].id;
}

/** Tope de `limitnum` de la línea de tiempo: Moodle no devuelve más de 50 por pedido. */
export const TIMELINE_PAGE_SIZE = 50;

/**
 * Pendientes de la línea de tiempo entre dos fechas (en segundos), de los cursos en los que el usuario
 * sigue activo. Moodle ya saca lo que el usuario completó. Para la página siguiente se pasa el último id.
 */
export function getActionEvents(
    session: AulaSession,
    from: number,
    to: number,
    afterEventId?: number,
): Promise<{ events: ActionEvent[] }> {
    const params: Record<string, number> = {
        timesortfrom: from,
        timesortto: to,
        limitnum: TIMELINE_PAGE_SIZE,
        limittononsuspendedevents: 1,
    };
    if (afterEventId !== undefined) params.aftereventid = afterEventId;
    return callWs(session, "core_calendar_get_action_events_by_timesort", params);
}

/**
 * Eventos del calendario entre dos fechas (en segundos) de esos cursos, más los personales y los del
 * sitio. Sin cursos, Moodle no devuelve los de ningún curso.
 */
export async function getCalendarEvents(
    session: AulaSession,
    courseIds: number[],
    from: number,
    to: number,
): Promise<CalendarEvent[]> {
    const params: Record<string, number> = {
        "options[timestart]": from,
        "options[timeend]": to,
        "options[userevents]": 1,
        "options[siteevents]": 1,
    };
    courseIds.forEach((id, i) => (params[`events[courseids][${i}]`] = id));
    const { events } = await callWs<{ events: CalendarEvent[] }>(session, "core_calendar_get_calendar_events", params);
    return events;
}

// --- Mensajes recibidos ---

/** Las conversaciones del usuario, las más recientes primero, cada una con su último mensaje. */
export async function getConversations(session: AulaSession, limitnum: number): Promise<Conversation[]> {
    const { userid } = await getSiteInfo(session);
    const { conversations } = await callWs<{ conversations: Conversation[] }>(
        session,
        "core_message_get_conversations",
        { userid, limitnum },
    );
    return conversations;
}

/** Conversaciones con mensajes sin leer. */
export async function getUnreadConversationsCount(session: AulaSession): Promise<number> {
    const { userid } = await getSiteInfo(session);
    return callWs<number>(session, "core_message_get_unread_conversations_count", { useridto: userid });
}

/**
 * Los mensajes de una conversación, los más nuevos primero (`newest`), desde `limitfrom`. No los marca como
 * leídos. Moodle rechaza una conversación de la que el usuario no es miembro.
 */
export async function getConversationMessages(
    session: AulaSession,
    convid: number,
    limitnum: number,
    limitfrom = 0,
): Promise<{ members: MessageMember[]; messages: Message[] }> {
    const { userid } = await getSiteInfo(session);
    return callWs(session, "core_message_get_conversation_messages", {
        currentuserid: userid,
        convid,
        limitnum,
        limitfrom,
        newest: 1,
    });
}
