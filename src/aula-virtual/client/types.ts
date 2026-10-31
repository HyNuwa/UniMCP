// Tipos de las respuestas de Moodle, con solo los campos que se usan.

export interface SiteInfo {
    sitename: string;
    username: string;
    fullname: string;
    userid: number;
    release: string;
    functions: { name: string; version: string }[];
    /** 0 si el sitio no deja bajar o subir archivos por el web service. */
    downloadfiles?: number;
    uploadfiles?: number;
}

/** `tool_mobile_get_public_config`: lo que el aula le muestra a la app antes del login. */
export interface PublicConfig {
    enablemobilewebservice?: number;
    maintenanceenabled?: number;
    /** 1 login en la app, 2 en el navegador, 3 en un navegador embebido. */
    typeoflogin?: number;
    identityproviders?: { name: string }[];
}

export interface Course {
    id: number;
    shortname: string;
    fullname: string;
    visible: number;
    progress?: number | null;
    lastaccess?: number | null;
}

export interface CourseModuleContent {
    type: "file" | "url" | "content";
    filename: string;
    filepath: string | null;
    filesize: number;
    fileurl: string;
    timemodified: number | null;
    mimetype?: string;
}

export interface CourseModule {
    id: number;
    name: string;
    modname: string;
    /**
 * Id de la instancia del plugin, no del módulo: el que piden las funciones mod_* (por ejemplo forumid).
 */
    instance: number;
    url?: string;
    description?: string;
    uservisible: boolean;
    availabilityinfo?: string;
    dates?: { label: string; timestamp: number }[];
    contents?: CourseModuleContent[];
}

export interface CourseSection {
    id: number;
    name: string;
    section: number;
    summary: string;
    uservisible?: boolean;
    availabilityinfo?: string;
    modules: CourseModule[];
}

export interface ForumDiscussion {
    /** Id de la discusión, el que pide mod_forum_get_discussion_posts. */
    discussion: number;
    subject: string;
    message: string;
    userfullname: string;
    created: number;
    timemodified: number;
    numreplies: number;
    userid: number;
    pinned: boolean;
    attachment: boolean;
}

export interface ForumPost {
    id: number;
    subject: string;
    /** Asunto sugerido por Moodle para responder ("Re: ..."). */
    replysubject: string;
    message: string;
    author: { id: number; fullname: string };
    timecreated: number;
    parentid: number | null;
    isdeleted: boolean;
    capabilities: { reply: boolean; edit: boolean; delete: boolean };
    /**
     * `mod_forum_get_discussion_posts` trae la URL en `url`, no en `fileurl` como el resto del web service.
     */
    attachments?: {
        filename: string;
        url?: string;
        fileurl?: string;
        filesize: number;
        mimetype?: string;
        timemodified?: number;
    }[];
}

export interface MoodleFile {
    filename: string;
    filepath?: string | null;
    filesize: number;
    fileurl: string;
    mimetype?: string;
    timemodified?: number | null;
}

/** Plugin de entrega o de devolución: con archivos (`fileareas`) o con texto (`editorfields`). */
export interface AssignPlugin {
    type: string;
    name: string;
    fileareas?: { area: string; files?: MoodleFile[] }[];
    editorfields?: { name: string; text: string; format: number }[];
}

export interface AssignSubmission {
    status: "new" | "draft" | "submitted" | "reopened" | string;
    timemodified: number;
    plugins?: AssignPlugin[];
}

export interface AssignSubmissionStatus {
    lastattempt?: {
        submission?: AssignSubmission;
        /** Si la tarea es grupal, vale esta y no la individual. */
        teamsubmission?: AssignSubmission;
        locked: boolean;
        graded: boolean;
        canedit: boolean;
        cansubmit: boolean;
        extensionduedate: number | null;
        gradingstatus: string;
    };
    feedback?: {
        gradefordisplay?: string;
        gradeddate?: number;
        plugins?: AssignPlugin[];
    };
}

export interface Assignment {
    id: number;
    cmid: number;
    duedate: number;
    cutoffdate: number;
    allowsubmissionsfromdate: number;
    /** 1: lo subido queda como borrador hasta confirmar el envío. */
    submissiondrafts: number;
    requiresubmissionstatement: number;
    /** Declaración en HTML que se acepta al enviar; viene solo si se la pide. */
    submissionstatement?: string;
    teamsubmission: number;
    maxattempts: number;
    configs: { plugin: string; subtype: string; name: string; value: string }[];
}

export interface Choice {
    id: number;
    coursemodule: number;
    allowupdate: boolean;
    allowmultiple: boolean;
    timeopen: number;
    timeclose: number;
}

/** Configuración de un cuestionario: fechas e intentos, sin preguntas. */
export interface Quiz {
    id: number;
    coursemodule: number;
    timeopen: number;
    timeclose: number;
    /** En segundos; 0 sin límite. */
    timelimit: number;
    /** Intentos permitidos; 0 sin límite. */
    attempts: number;
    /** Nota máxima del cuestionario, y la suma de puntajes de sus preguntas con la que se escala. */
    grade?: number;
    sumgrades?: number | null;
}

export interface QuizAttempt {
    attempt: number;
    state: "inprogress" | "overdue" | "finished" | "abandoned" | string;
    timestart: number;
    timefinish: number;
    /** Puntaje sin escalar; null si el docente no deja verlo todavía. */
    sumgrades: number | null;
}

export interface ChoiceOption {
    id: number;
    /** Texto de la opción en choice; en choicegroup está en `name`. */
    text?: string;
    name?: string;
    maxanswers?: number;
    countanswers?: number;
    checked?: boolean;
    disabled?: boolean;
}

/** Un pendiente de la línea de tiempo: algo que el usuario todavía tiene que hacer. */
export interface ActionEvent {
    id: number;
    name: string;
    modulename: string;
    /** `due`, `close`, etc.: qué momento de la actividad marca. */
    eventtype: string;
    /** Fecha por la que se ordena la línea de tiempo, en segundos. */
    timesort: number;
    course: { id: number; fullname: string };
    /** `actionable: false` cuando todavía no se puede hacer, por ejemplo un cuestionario sin abrir. */
    action?: { name: string; actionable: boolean };
    /** La página de la actividad, `.../mod/<tipo>/view.php?id=<cmid>`. */
    url?: string;
}

/** Un evento del calendario: de una actividad, del curso, de un grupo, del sitio o personal. */
export interface CalendarEvent {
    id: number;
    name: string;
    description: string;
    courseid: number;
    /** Vacío en los eventos que no son de una actividad. */
    modulename: string;
    instance: number;
    eventtype: string;
    timestart: number;
    /** En segundos. */
    timeduration: number;
}

/** Un ítem del libro de calificaciones (`gradereport_user_get_grade_items`). */
export interface GradeItem {
    id: number;
    itemname: string | null;
    /** `course` (el total), `category`, `mod` (una actividad) o `manual` (cargado a mano). */
    itemtype: string;
    itemmodule: string | null;
    cmid?: number;
    /** Ya formateados por Moodle: "7,50", "-" sin nota, "0&ndash;10" (con entidades). */
    gradeformatted?: string;
    rangeformatted?: string;
    percentageformatted?: string;
    feedback?: string;
    gradeishidden?: boolean;
    gradedategraded?: number | null;
}

/** Qué cambió en un curso (`core_course_get_updates_since`). */
export interface CourseUpdates {
    instances: {
        /** `module` para una actividad o recurso; `id` es entonces su cmid. */
        contextlevel: string;
        id: number;
        updates: { name: string; timeupdated?: number; itemids?: number[] }[];
    }[];
}

/** Un módulo sin su contenido (`core_course_get_course_module`). */
export interface ModuleInfo {
    id: number;
    course: number;
    name: string;
    modname: string;
}

export interface MessageMember {
    id: number;
    fullname: string;
}

export interface Message {
    id: number;
    useridfrom: number;
    /** HTML. */
    text: string;
    timecreated: number;
}

/** Una conversación del usuario (`core_message_get_conversations`). */
export interface Conversation {
    id: number;
    /** El nombre de un grupo; vacío en una conversación entre dos. */
    name: string | null;
    /** 1 entre dos personas, 2 de grupo, 3 con uno mismo. */
    type: number;
    isread: boolean;
    unreadcount: number | null;
    /** Los otros miembros, sin el usuario. */
    members: MessageMember[];
    /** Solo el último mensaje. */
    messages: Message[];
}
