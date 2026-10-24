// Tipos de las respuestas de Moodle, con solo los campos que se usan.

export interface SiteInfo {
    sitename: string;
    username: string;
    fullname: string;
    userid: number;
    release: string;
    functions: { name: string; version: string }[];
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
    attachments: { filename: string; fileurl: string; filesize: number; mimetype?: string }[];
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
