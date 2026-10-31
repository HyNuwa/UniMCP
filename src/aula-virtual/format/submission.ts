import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import { CONFIRMATION_TTL_MS, confirmationProblem, fingerprint, issueConfirmation } from "../../shared/confirmation.js";
import { isoDate } from "../../shared/dates.js";
import { htmlToText, textToHtml } from "../../shared/html.js";
import {
    checkFiles,
    formatSize,
    sized,
    type FileSource,
    type UploadedFile,
    type UploadInbox,
    type UploadLimits,
} from "../../shared/uploads.js";
import {
    getAssignments,
    getSiteInfo,
    getSubmissionStatus,
    getUnusedDraftItemId,
    removeSubmission,
    saveSubmission,
    submitForGrading,
} from "../client/moodle.js";
import { fetchFile, MoodleError, uploadDraftFiles } from "../client/web-service.js";
import type { AulaSession } from "../client/session.js";
import type { AssignSubmission, MoodleFile } from "../client/types.js";
import { viewSubmission } from "./activities.js";
import { parseAddress } from "./address.js";
import { userFacingUrl } from "./files.js";
import { findModule } from "./navigation.js";

/** Lo que contesta Moodle cuando una función no existe en su versión o no está en el servicio de la app. */
const NOT_ENABLED = new Set(["invalidrecord", "accessexception", "servicenotavailable"]);

/** Tope por archivo del aula (`usermaxuploadfilesize` del sitio, 20 MB). */
const SITE_MAX_BYTES = 20 * 1024 * 1024;

export interface SubmissionRequest {
    /**
 * Lista final de archivos: rutas locales (solo en STDIO) o la `url` de alguno que ya está entregado.
 */
    files?: string[];
    /** Id de un link de subida (solo en HTTP); sus archivos se agregan a la lista. */
    upload?: string;
    /** Texto plano que manda el modelo; pisa el texto en línea. */
    text?: string;
    /** Si la tarea usa borradores, confirmar el envío. */
    send: boolean;
    acceptStatement: boolean;
    /** El código de la vista previa; sin él, no se cambia nada. */
    confirmation?: string;
}

/**
 * La tarea con su configuración y el intento vigente del usuario, o un error que explica por qué no se
 * puede.
 */
async function openAssignment(session: AulaSession, rawAddress: string) {
    const address = parseAddress(rawAddress);
    if (address.level !== "module") throw new Error(`"${rawAddress}" no es la dirección de un módulo.`);
    const { module } = await findModule(session, address.courseId, address.cmid);
    if (module.modname !== "assign") {
        throw new Error(`"${rawAddress}" es un módulo de tipo ${module.modname}; solo se entregan tareas (assign).`);
    }

    const [assignments, status] = await Promise.all([
        getAssignments(session, address.courseId),
        getSubmissionStatus(session, module.instance),
    ]);
    const assignment = assignments.find((a) => a.cmid === module.id);
    const attempt = status.lastattempt;
    if (!assignment || !attempt) throw new Error(`No se pudo leer la configuración de la tarea ${rawAddress}.`);

    const config = (plugin: string, name: string) =>
        assignment.configs.find((c) => c.subtype === "assignsubmission" && c.plugin === plugin && c.name === name)
            ?.value;
    const limits: UploadLimits = {
        maxFiles: Number(config("file", "maxfilesubmissions")) || undefined,
        maxBytes: Number(config("file", "maxsubmissionsizebytes")) || SITE_MAX_BYTES,
        extensions: extensions(config("file", "filetypeslist") || ""),
    };
    return {
        address,
        module,
        assignment,
        attempt,
        config,
        limits,
        acceptsFiles: config("file", "enabled") === "1",
        acceptsText: config("onlinetext", "enabled") === "1",
        submission: attempt.teamsubmission ?? attempt.submission,
    };
}

const CLOSED =
    "La tarea no acepta cambios: ya está enviada, venció, está bloqueada o todavía no abre. " +
    "Abrila con aula_open para ver el estado y las fechas.";

/**
 * Crea un link para recibir los archivos de una entrega en modo HTTP, con los límites que pone la
 * tarea.
 */
export async function createUploadLink(session: AulaSession, rawAddress: string, inbox: UploadInbox, owner: string) {
    const { module, attempt, acceptsFiles, limits } = await openAssignment(session, rawAddress);
    if (!acceptsFiles) throw new Error("Esta tarea no acepta archivos.");
    if (!attempt.canedit) throw new Error(CLOSED);

    const { id, url, expiresAt } = inbox.open(owner, `Entrega: ${module.name}`, limits);
    return {
        subida: id,
        url,
        vence: expiresAt,
        acepta: {
            maximo: limits.maxFiles,
            tamanioMaximo: limits.maxBytes,
            extensiones: limits.extensions?.join(", "),
        },
        conTerminal: `curl -F "archivos=@/ruta/al/archivo.pdf" ${url}`,
    };
}

/**
 * Un archivo de la lista final: uno que ya está en la entrega (se baja recién al guardar, porque el
 * borrador reemplaza todo el área) o uno nuevo, con sus bytes.
 */
type PlannedFile = { name: string; size: number } & ({ existing: MoodleFile } | { bytes: Uint8Array });

/**
 * Deja la entrega con los archivos y el texto indicados y la envía si corresponde. Lo que no se indica
 * se mantiene: como Moodle pisa cada plugin con lo que recibe, se le vuelve a mandar lo que ya había.
 *
 * Sin `confirmation` no cambia nada: devuelve la vista previa (qué archivos se suman, quedan y se
 * quitan, si se envía) y el código para confirmarla. Con el código, y solo si nada cambió, entrega.
 */
export async function submitAssignment(
    session: AulaSession,
    rawAddress: string,
    request: SubmissionRequest,
    source: FileSource,
) {
    const plan = await planSubmission(session, rawAddress, request, source);
    const print = fingerprint(await planParts(session, plan));
    if (request.confirmation === undefined) return preview(plan, issueConfirmation(print));

    const problem = confirmationProblem(request.confirmation, print);
    if (problem) throw new Error(problem);
    return applySubmission(session, plan, request, source);
}

/** Lo que va a pasar con la entrega, validado contra la tarea, sin tocar nada. */
async function planSubmission(session: AulaSession, rawAddress: string, request: SubmissionRequest, source: FileSource) {
    const opened = await openAssignment(session, rawAddress);
    const { assignment, attempt, config, limits, acceptsFiles, acceptsText, submission } = opened;
    const usesDrafts = assignment.submissiondrafts === 1;
    const fileChanges = request.files !== undefined || request.upload !== undefined;
    const changes = fileChanges || request.text !== undefined;

    // Se valida todo lo posible antes de modificar algo, para que la entrega no quede a medio hacer.
    if (!changes && !(usesDrafts && request.send)) {
        throw new Error("Pasá archivos, `texto` o los dos: no hay nada para entregar.");
    }
    if (changes && !attempt.canedit) throw new Error(CLOSED);
    if (fileChanges && !acceptsFiles) throw new Error("Esta tarea no acepta archivos.");
    if (request.text !== undefined && !acceptsText) throw new Error("Esta tarea no acepta texto en línea.");
    const confirm = usesDrafts && request.send;
    if (confirm && assignment.requiresubmissionstatement === 1 && !request.acceptStatement) {
        throw new Error(
            "Para enviarla hay que aceptar esta declaración: «" +
                htmlToText(assignment.submissionstatement) +
                "». Mostrásela al usuario y, si la acepta, volvé a llamar con `aceptoDeclaracion: true`.",
        );
    }

    const current = submittedFiles(submission);
    const files = changes && acceptsFiles ? await collectFiles(request, current, source) : undefined;
    if (files) checkFiles(files, limits);
    const oldText = currentOrNewText(submission, undefined, 0);
    const text = changes && acceptsText ? currentOrNewText(submission, request.text, Number(config("onlinetext", "wordlimit"))) : null;
    const removes = changes && !files?.length && !htmlToText(text?.html);
    if (removes && !current.length && !htmlToText(oldText.html)) {
        throw new Error("Pasá archivos, `texto` o los dos: no hay nada para entregar.");
    }
    if (removes) await requireRemoval(session, opened.module);

    return { ...opened, rawAddress, usesDrafts, changes, confirm, current, files, oldText, text, removes };
}

type Plan = Awaited<ReturnType<typeof planSubmission>>;

/**
 * Todo lo que define la entrega: quién, qué tarea, en qué estado estaba y qué se va a guardar. Un
 * cambio en cualquiera (otro archivo, otro texto, una entrega hecha en el medio) invalida el código.
 */
async function planParts(session: AulaSession, plan: Plan) {
    const { userid } = await getSiteInfo(session);
    return {
        sitio: session.site.baseUrl,
        usuario: userid,
        tarea: plan.assignment.id,
        estado: [plan.submission?.status, plan.submission?.timemodified],
        archivos: plan.files?.map((f) =>
            "existing" in f
                ? [f.existing.fileurl, f.existing.filesize, f.existing.timemodified]
                : [f.name, createHash("sha256").update(f.bytes).digest("base64url")],
        ),
        texto: plan.text?.html,
        borra: plan.removes,
        envia: plan.confirm,
    };
}

function preview(plan: Plan, confirmacion: string) {
    const { assignment, module, current, files, oldText, text } = plan;
    const kept = new Set(files?.flatMap((f) => ("existing" in f ? [f.existing.fileurl] : [])));
    const textChanges = text && text.html !== oldText.html;
    return {
        vistaPrevia: "Todavía no se entregó nada.",
        tarea: module.name,
        direccion: plan.rawAddress,
        vence: isoDate(assignment.duedate) ?? undefined,
        cierre: isoDate(assignment.cutoffdate) ?? undefined,
        archivos: files && {
            seSuman: files.filter((f) => !("existing" in f)).map((f) => f.name),
            quedan: files.filter((f) => "existing" in f).map((f) => f.name),
            seQuitan: current.filter((f) => !kept.has(f.fileurl)).map((f) => f.filename),
        },
        texto: textChanges ? (htmlToText(text.html) ? "reemplaza el texto en línea" : "borra el texto en línea") : undefined,
        borraLaEntrega: plan.removes || undefined,
        envio: plan.confirm
            ? "Se envía para calificar: después, en general, no se puede cambiar."
            : plan.usesDrafts
              ? "Queda como borrador: no cuenta como entregada hasta confirmar el envío."
              : plan.changes
                ? "Esta tarea no usa borradores: guardar ya es entregar."
                : undefined,
        confirmacion,
        aviso:
            "Mostrale esto al usuario, sobre todo lo que se quita. Si está de acuerdo, llamá de nuevo con " +
            `los mismos parámetros y \`confirmacion\`; vence en ${CONFIRMATION_TTL_MS / 60_000} minutos.`,
    };
}

async function applySubmission(session: AulaSession, plan: Plan, request: SubmissionRequest, source: FileSource) {
    const { address, module, assignment, files, text } = plan;
    if (plan.changes) {
        if (plan.removes) {
            await removeSubmission(session, assignment.id).catch((e) => {
                if (!(e instanceof MoodleError) || !NOT_ENABLED.has(e.errorcode ?? "")) throw e;
                throw new Error(cannotRemove(module));
            });
        } else {
            const uploads = await Promise.all(
                (files ?? []).map(async (f) =>
                    "existing" in f
                        ? { name: f.name, bytes: (await fetchFile(session, new URL(f.existing.fileurl), SITE_MAX_BYTES)).bytes }
                        : { name: f.name, bytes: f.bytes },
                ),
            );
            await saveSubmission(session, assignment.id, {
                filesItemId: files
                    ? uploads.length
                        ? await uploadDraftFiles(session, uploads)
                        : await getUnusedDraftItemId(session)
                    : undefined,
                text: text ? { ...text, itemid: await getUnusedDraftItemId(session) } : undefined,
            });
        }
        if (request.upload && !source.local) source.inbox.close(request.upload);
    }

    if (plan.confirm) await submitForGrading(session, assignment.id, request.acceptStatement);

    const after = await viewSubmission(session, address.courseId, module);
    return {
        direccion: plan.rawAddress,
        estado: after.estado,
        // Con borradores sin confirmar, lo subido todavía no vale.
        aviso:
            plan.usesDrafts && !request.send && after.estado === "borrador"
                ? "Quedó como borrador: no cuenta como entregada hasta confirmar el envío."
                : undefined,
        archivos: after.archivos?.map(({ nombre, tamanio, url }) => ({ nombre, tamanio, url })),
        texto: after.texto,
    };
}

const cannotRemove = (module: { url?: string }) =>
    "Esta aula no deja borrar la entrega entera desde UniMCP. El usuario la puede borrar desde el " +
    `navegador${module.url ? `: ${userFacingUrl(module.url)}` : ""}.`;

/**
 * Algunas aulas no habilitan borrar la entrega en el servicio de la app (UNJu): se avisa en la vista
 * previa y no después de confirmar.
 */
async function requireRemoval(session: AulaSession, module: { url?: string }) {
    const { functions } = await getSiteInfo(session);
    if (functions && !functions.some((f) => f.name === "mod_assign_remove_submission")) {
        throw new Error(cannotRemove(module));
    }
}

function submittedFiles(submission: AssignSubmission | undefined): MoodleFile[] {
    return (submission?.plugins ?? [])
        .filter((p) => p.type === "file")
        .flatMap((p) => p.fileareas?.flatMap((a) => a.files ?? []) ?? []);
}

const newFile = (f: UploadedFile): PlannedFile => ({ ...sized(f), bytes: f.bytes });

/** La lista final: la de `files` (o los ya entregados si no se pasa) más los del link de subida. */
async function collectFiles(request: SubmissionRequest, current: MoodleFile[], source: FileSource): Promise<PlannedFile[]> {
    const entries = request.files ?? current.map((f) => userFacingUrl(f.fileurl));
    const collected: PlannedFile[] = [];
    for (const entry of entries) {
        const existing = current.find((f) => userFacingUrl(f.fileurl) === entry || f.fileurl === entry);
        collected.push(
            existing
                ? { name: existing.filename, size: existing.filesize, existing }
                : newFile(await readLocal(entry, source)),
        );
    }
    if (request.upload !== undefined) {
        if (source.local) throw new Error("`subida` es del modo HTTP; acá los archivos van como ruta en `archivos`.");
        collected.push(...source.inbox.take(request.upload, source.owner).map(newFile));
    }
    return collected;
}

async function readLocal(path: string, source: FileSource): Promise<UploadedFile> {
    if (/^https?:\/\//i.test(path)) {
        throw new Error(
            `"${path}" no es un archivo de esta entrega. Las URLs sirven solo para conservar archivos ` +
                "que ya están subidos (las `url` de `entrega.archivos` en aula_open).",
        );
    }
    if (!source.local) {
        throw new Error(
            `"${path}" no es un archivo de esta entrega, y este servidor no lee archivos de tu dispositivo: ` +
                "los nuevos se suben con aula_assign_upload_link y se pasan con `subida`.",
        );
    }
    if (!isAbsolute(path)) throw new Error(`Pasá la ruta absoluta del archivo; "${path}" es relativa.`);

    let size: number;
    try {
        const info = await stat(path);
        if (!info.isFile()) throw new Error(`"${path}" no es un archivo.`);
        size = info.size;
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`No existe el archivo "${path}".`);
        throw e;
    }
    // El límite de la tarea lo revisa checkFiles; esto solo evita traer a memoria algo que igual no
    // entraría.
    if (size > SITE_MAX_BYTES) {
        throw new Error(`"${basename(path)}" pesa ${formatSize(size)} y el aula acepta hasta ${formatSize(SITE_MAX_BYTES)} por archivo.`);
    }
    return { name: basename(path), bytes: new Uint8Array(await readFile(path)) };
}

/**
 * Moodle controla los tipos de archivo en el formulario web pero no en el web service: sin este
 * chequeo, un .docx pasaría en una tarea que pide PDF. Los grupos de tipos ("document", "image")
 * necesitan la tabla de Moodle para resolverse, así que si la lista tiene alguno no se restringe nada.
 */
function extensions(types: string): string[] | undefined {
    const list = types
        .split(/[\s,;]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    return list.length && list.every((t) => t.startsWith(".")) ? list : undefined;
}

/** Texto nuevo en HTML, o el anterior, para no borrarlo cuando solo se guardan archivos. */
function currentOrNewText(submission: AssignSubmission | undefined, text: string | undefined, wordLimit: number) {
    if (text === undefined) {
        const field = submission?.plugins
            ?.find((p) => p.type === "onlinetext")
            ?.editorfields?.find((e) => e.name === "onlinetext");
        return { html: field?.text ?? "", format: field?.format ?? 1 };
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    if (wordLimit && words > wordLimit) {
        throw new Error(`El texto tiene ${words} palabras y la tarea acepta hasta ${wordLimit}.`);
    }
    return { html: text.trim() ? textToHtml(text) : "", format: 1 };
}
