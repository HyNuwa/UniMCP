import { htmlToText } from "../../shared/html.js";
import {
    getAssignments,
    getChoiceOptions,
    getChoicegroupOptions,
    getChoices,
    getQuizAttempts,
    getQuizzes,
    getSubmissionStatus,
} from "../client/moodle.js";
import { MoodleError } from "../client/web-service.js";
import type { AulaSite } from "../../shared/campus.js";
import type { AulaSession } from "../client/session.js";
import type { AssignPlugin, ChoiceOption, CourseModule, MoodleFile, Quiz, QuizAttempt } from "../client/types.js";
import { isoDate, richText, toFile } from "./fields.js";

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
    new: "sin entregar",
    draft: "borrador",
    submitted: "enviada",
    reopened: "reabierta",
};

/**
 * Entrega del usuario (o de su grupo): qué admite la tarea, qué se subió y la devolución, si existe.
 */
export async function viewSubmission(session: AulaSession, courseId: number, module: CourseModule) {
    const [assignments, status] = await Promise.all([
        getAssignments(session, courseId),
        getSubmissionStatus(session, module.instance),
    ]);
    const assignment = assignments.find((a) => a.cmid === module.id);
    const attempt = status.lastattempt;
    // En tareas grupales la entrega individual está vacía; vale la del grupo.
    const submission = attempt?.teamsubmission ?? attempt?.submission;
    const config = (plugin: string, name: string) =>
        assignment?.configs.find((c) => c.subtype === "assignsubmission" && c.plugin === plugin && c.name === name)
            ?.value;

    const accepts = [];
    if (config("file", "enabled") === "1") {
        accepts.push({
            tipo: "archivos",
            maximo: Number(config("file", "maxfilesubmissions")) || undefined,
            tamanioMaximo: Number(config("file", "maxsubmissionsizebytes")) || undefined,
            extensiones: config("file", "filetypeslist") || undefined,
        });
    }
    if (config("onlinetext", "enabled") === "1") {
        accepts.push({ tipo: "texto en línea", limitePalabras: Number(config("onlinetext", "wordlimit")) || undefined });
    }

    const feedback = status.feedback;
    return {
        estado: submission ? (SUBMISSION_STATUS_LABELS[submission.status] ?? submission.status) : "sin entregar",
        grupal: assignment?.teamsubmission === 1 || undefined,
        // Moodle genera una entrega vacía cuando se abre la tarea, así que su fecha no significa nada
        // mientras no haya nada subido.
        modificada: (submission?.status !== "new" && isoDate(submission?.timemodified)) || undefined,
        abre: isoDate(assignment?.allowsubmissionsfromdate) || undefined,
        vence: isoDate(assignment?.duedate) || undefined,
        prorroga: isoDate(attempt?.extensionduedate) || undefined,
        cierreDefinitivo: isoDate(assignment?.cutoffdate) || undefined,
        acepta: accepts.length ? accepts : undefined,
        // Con borradores, lo subido no vale hasta que se confirma el envío.
        requiereConfirmarEnvio: assignment?.submissiondrafts === 1 || undefined,
        requiereDeclaracion: assignment?.requiresubmissionstatement === 1 || undefined,
        declaracion:
            (assignment?.requiresubmissionstatement === 1 && htmlToText(assignment.submissionstatement)) || undefined,
        puedeEditar: attempt?.canedit ?? false,
        puedeEnviar: attempt?.cansubmit || undefined,
        bloqueada: attempt?.locked || undefined,
        ...pluginContent(session.site, submission?.plugins),
        devolucion: feedback
            ? {
                  calificacion: feedback.gradefordisplay || undefined,
                  fecha: isoDate(feedback.gradeddate),
                  ...pluginContent(session.site, feedback.plugins),
              }
            : undefined,
    };
}

/** Archivos y textos de una entrega o devolución, salteando los plugins sin contenido. */
function pluginContent(site: AulaSite, plugins: AssignPlugin[] = []) {
    const files: MoodleFile[] = plugins.flatMap((p) => p.fileareas?.flatMap((a) => a.files ?? []) ?? []);
    const texts = plugins
        .flatMap((p) => p.editorfields ?? [])
        .map((e) => richText(site, e.text))
        .filter(Boolean);
    return {
        archivos: files.length ? files.map(toFile) : undefined,
        texto: texts.length ? texts.join("\n\n") : undefined,
    };
}

const ATTEMPT_STATE_LABELS: Record<string, string> = {
    inprogress: "en curso",
    overdue: "vencido sin enviar",
    finished: "terminado",
    abandoned: "abandonado",
};

/**
 * Fechas, límite de tiempo e intentos de un cuestionario. El `estado` se calcula acá contra `now`: con
 * las fechas solas, el modelo dio por vigente uno que ya había cerrado. `now` se inyecta en los tests.
 */
export async function viewQuiz(session: AulaSession, courseId: number, module: CourseModule, now = new Date()) {
    const [quizzes, attempts] = await Promise.all([
        getQuizzes(session, courseId),
        // Un aula que no deja ver los intentos no impide mostrar las fechas.
        getQuizAttempts(session, module.instance).catch((e) => {
            if (e instanceof MoodleError) return undefined;
            throw e;
        }),
    ]);
    const quiz = quizzes.find((q) => q.coursemodule === module.id);
    if (!quiz) return { aviso: "El aula no mostró la configuración de este cuestionario: mirá sus fechas en su `url`." };

    const seconds = now.getTime() / 1000;
    const state =
        quiz.timeopen && seconds < quiz.timeopen
            ? "todavía no abre"
            : quiz.timeclose && seconds > quiz.timeclose
              ? "cerrado"
              : "abierto";
    const made = attempts?.length ?? 0;
    return {
        estado: state,
        abre: isoDate(quiz.timeopen) || undefined,
        cierra: isoDate(quiz.timeclose) || undefined,
        // Que no traiga `cierra` no dice si no tiene o si no se pudo leer: se dice.
        sinCierre: !quiz.timeclose || undefined,
        limiteMinutos: quiz.timelimit ? Math.round(quiz.timelimit / 60) : undefined,
        intentosPermitidos: quiz.attempts || "sin límite",
        intentosQuedan: attempts && quiz.attempts ? Math.max(quiz.attempts - made, 0) : undefined,
        intentos: attempts?.map((a) => toAttempt(a, quiz)),
    };
}

function toAttempt(a: QuizAttempt, quiz: Quiz) {
    const scale = quiz.grade && quiz.sumgrades ? quiz.grade / quiz.sumgrades : undefined;
    return {
        numero: a.attempt,
        estado: ATTEMPT_STATE_LABELS[a.state] ?? a.state,
        empezado: isoDate(a.timestart) || undefined,
        terminado: isoDate(a.timefinish) || undefined,
        // Sin `nota`, el docente todavía no deja ver el puntaje.
        nota: a.sumgrades !== null && scale ? `${Math.round(a.sumgrades * scale * 100) / 100} / ${quiz.grade}` : undefined,
    };
}

export async function viewChoice(session: AulaSession, courseId: number, module: CourseModule) {
    const [choices, options] = await Promise.all([
        getChoices(session, courseId),
        getChoiceOptions(session, module.instance),
    ]);
    const choice = choices.find((c) => c.coursemodule === module.id);
    return {
        multiple: choice?.allowmultiple || undefined,
        puedeCambiar: choice?.allowupdate,
        abre: isoDate(choice?.timeopen) || undefined,
        cierra: isoDate(choice?.timeclose) || undefined,
        opciones: options.map(toOption),
    };
}

/**
 * El plugin no informa si se puede cambiar la elección o tomar varios grupos; se sabe por la
 * descripción o por el error al intentarlo.
 */
export async function viewChoicegroup(session: AulaSession, module: CourseModule) {
    const options = await getChoicegroupOptions(session, module.instance);
    return { opciones: options.map(toOption) };
}

export function toOption(o: ChoiceOption) {
    return {
        id: o.id,
        texto: o.text ?? o.name,
        elegida: o.checked || undefined,
        deshabilitada: o.disabled || undefined,
        cupo: o.maxanswers || undefined,
        anotados: o.countanswers,
    };
}
