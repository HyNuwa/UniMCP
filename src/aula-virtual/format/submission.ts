import { readFile, stat } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import { htmlToText, textToHtml } from "../../shared/html.js";
import {
    checkFiles,
    formatSize,
    type FileSource,
    type UploadedFile,
    type UploadInbox,
    type UploadLimits,
} from "../../shared/uploads.js";
import {
    getAssignments,
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
 * Deja la entrega con los archivos y el texto indicados y la envía si corresponde. Lo que no se indica
 * se mantiene: como Moodle pisa cada plugin con lo que recibe, se le vuelve a mandar lo que ya había.
 */
export async function submitAssignment(
    session: AulaSession,
    rawAddress: string,
    request: SubmissionRequest,
    source: FileSource,
) {
    const { address, module, assignment, attempt, config, limits, acceptsFiles, acceptsText, submission } =
        await openAssignment(session, rawAddress);
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

    if (changes) {
        const files = acceptsFiles ? await collectFiles(session, request, submittedFiles(submission), source) : [];
        checkFiles(files, limits);
        const text = acceptsText
            ? currentOrNewText(submission, request.text, Number(config("onlinetext", "wordlimit")))
            : null;

        if (!files.length && !htmlToText(text?.html)) {
            await removeSubmission(session, assignment.id).catch((e) => {
                // Algunas aulas no habilitan la función en el servicio de la app (UNJu).
                if (!(e instanceof MoodleError) || !NOT_ENABLED.has(e.errorcode ?? "")) throw e;
                const where = module.url ? `: ${userFacingUrl(module.url)}` : "";
                throw new Error(
                    "Esta aula no deja borrar la entrega entera desde UniMCP. El usuario la puede borrar " +
                        `desde el navegador${where}.`,
                );
            });
        } else {
            await saveSubmission(session, assignment.id, {
                filesItemId: acceptsFiles
                    ? files.length
                        ? await uploadDraftFiles(session, files)
                        : await getUnusedDraftItemId(session)
                    : undefined,
                text: text ? { ...text, itemid: await getUnusedDraftItemId(session) } : undefined,
            });
        }
        if (request.upload && !source.local) source.inbox.close(request.upload);
    }

    if (confirm) await submitForGrading(session, assignment.id, request.acceptStatement);

    const after = await viewSubmission(session, address.courseId, module);
    return {
        direccion: rawAddress,
        estado: after.estado,
        // Con borradores sin confirmar, lo subido todavía no vale.
        aviso:
            usesDrafts && !request.send && after.estado === "borrador"
                ? "Quedó como borrador: no cuenta como entregada hasta confirmar el envío."
                : undefined,
        archivos: after.archivos?.map(({ nombre, tamanio, url }) => ({ nombre, tamanio, url })),
        texto: after.texto,
    };
}

function submittedFiles(submission: AssignSubmission | undefined): MoodleFile[] {
    return (submission?.plugins ?? [])
        .filter((p) => p.type === "file")
        .flatMap((p) => p.fileareas?.flatMap((a) => a.files ?? []) ?? []);
}

/**
 * Reúne los bytes de la lista final: los de `files` (o los ya entregados si no se pasa) y los del link
 * de subida. Los ya entregados se suben de nuevo porque el borrador reemplaza todo el área.
 */
async function collectFiles(
    session: AulaSession,
    request: SubmissionRequest,
    current: MoodleFile[],
    source: FileSource,
): Promise<UploadedFile[]> {
    const entries = request.files ?? current.map((f) => userFacingUrl(f.fileurl));
    const collected: UploadedFile[] = [];
    for (const entry of entries) {
        const existing = current.find((f) => userFacingUrl(f.fileurl) === entry || f.fileurl === entry);
        collected.push(
            existing
                ? {
                      name: existing.filename,
                      bytes: (await fetchFile(session, new URL(existing.fileurl), SITE_MAX_BYTES)).bytes,
                  }
                : await readLocal(entry, source),
        );
    }
    if (request.upload !== undefined) {
        if (source.local) throw new Error("`subida` es del modo HTTP; acá los archivos van como ruta en `archivos`.");
        collected.push(...source.inbox.take(request.upload, source.owner));
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
