import { htmlToText } from "../../shared/html.js";
import {
    getAssignments,
    getChoiceOptions,
    getChoicegroupOptions,
    getChoices,
    getSubmissionStatus,
} from "../client/moodle.js";
import type { AulaSite } from "../../shared/campus.js";
import type { AulaSession } from "../client/session.js";
import type { AssignPlugin, ChoiceOption, CourseModule, MoodleFile } from "../client/types.js";
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
