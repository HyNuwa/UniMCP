import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { FileSource } from "../shared/uploads.js";
import { getSiteInfo } from "./client/moodle.js";
import type { AulaSession } from "./client/session.js";
import {
    addCalendarEvent,
    answerChoice,
    deleteForumPost,
    editForumPost,
    postToForum,
    sendMessage,
} from "./format/writes.js";
import { ROOT } from "./format/address.js";
import { DEFAULT_DAYS, MAX_DAYS, upcoming } from "./format/agenda.js";
import { readAulaFile } from "./format/files.js";
import { open } from "./format/navigation.js";
import { search } from "./format/search.js";
import { createUploadLink, submitAssignment } from "./format/submission.js";

// JSON compacto: con indentación estas respuestas ocupan alrededor de 25% más de contexto sin leerse
// mejor.
const json = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
});

const failure = (e: unknown) => ({
    content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }],
    isError: true,
});

/** Le permite al cliente separar las tools que leen de las que modifican el aula. */
const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

export function registerAulaVirtualTools(server: McpServer, session: AulaSession, files: FileSource) {
    server.registerTool(
        "aula_get_site_info",
        {
            description: "Datos del usuario logueado en el aula virtual (Moodle) de su campus y del sitio.",
            annotations: READ_ONLY,
        },
        async () => {
            try {
                const { sitename, fullname, username, userid, release } = await getSiteInfo(session);
                return json({ sitename, fullname, username, userid, release });
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "aula_list_courses",
        {
            description:
                "Lista los cursos (materias) en los que está inscripto el usuario. Es el punto de entrada: " +
                "cada curso viene con su `direccion`, que se le pasa a aula_open para entrar.",
            annotations: READ_ONLY,
        },
        async () => {
            try {
                return json(await open(session, ROOT));
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "aula_open",
        {
            description:
                "Entra a una dirección del aula virtual y devuelve lo que hay ahí: un curso con sus secciones " +
                "y módulos, una sección con sus módulos, un módulo con sus archivos y fechas, un foro con el " +
                "índice de sus discusiones, o una discusión con sus mensajes completos.\n\n" +
                "Un curso grande no entra en una respuesta: viene con `indice` y cada sección trae solo su " +
                "nombre, un resumen, cuántos `modulos` tiene y de qué `tipos`, y sus `actividades` (foros, " +
                "tareas, cuestionarios) con nombre y `direccion` para entrar directo. Para ver el resto de sus " +
                "módulos se abre la sección con su `direccion`.\n\n" +
                "En los mapas de curso y de sección los módulos vienen resumidos: las etiquetas traen su texto " +
                "entero cuando entra, y el resto una descripción corta. Cuando algo se cortó para que entre, " +
                "viene `recortado` y un `aviso` que dice qué falta y cómo verlo: etiquetas resumidas, " +
                "`modulosOmitidos` al final de una sección o `seccionesOmitidas` del índice, con su `direccion` " +
                "(los primeros 20; `otrosOmitidos` u `otrasOmitidas` dicen cuántos más hay). Al abrir un " +
                "módulo aparecen su `url` " +
                "web, la descripción entera y todos los datos de sus archivos.\n\n" +
                "Según el tipo de módulo trae además: en una tarea (assign), `entrega` con el estado, el " +
                "vencimiento, lo que se subió y la devolución con la nota; en una elección (choice) o " +
                "selección de grupos (choicegroup), `eleccion` con las opciones y sus ids; en un foro, " +
                "`puedeAbrirHilo`; en una discusión, el `id`, el `autorId` y las `acciones` permitidas de " +
                "cada publicación. Es lo que piden las tools que escriben en el aula.\n\n" +
                "No hace falta armar la dirección: cada respuesta trae las direcciones de lo que hay adentro " +
                "(`direccion`) y la de un nivel más arriba (`padre`), así que se navega pasando de vuelta una " +
                "de esas. Para empezar, usar aula_list_courses o la dirección \"/\".\n\n" +
                "Cuando la pregunta nombra la materia, lo habitual es entrar al curso y abrir lo que " +
                "corresponda: la sección donde está el tema, el índice de un foro (muestra los asuntos sin " +
                "volcar los mensajes enteros) o un archivo como el cronograma con aula_read_file. Si no se " +
                "sabe en qué materia está algo, o se busca el texto de un aviso, aula_search lo encuentra con " +
                "una llamada.\n\n" +
                "Los archivos vienen con una `url`, que sirve para leerlos con aula_read_file y también para " +
                "dársela al usuario si quiere bajarlo: se abre con su sesión del aula.",
            inputSchema: z.object({
                direccion: z
                    .string()
                    .describe(
                        'Dirección a abrir, sacada de una respuesta anterior. Ej: "/", "/curso/691", ' +
                            '"/curso/691/sec/6", "/curso/691/mod/34806", "/curso/691/mod/34806/disc/421348".',
                    ),
                pagina: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe(
                        "Solo para foros: página del índice de discusiones, de 50 en 50. La respuesta avisa " +
                            "con `hayMasDiscusiones` cuando hay otra.",
                    ),
            }),
            annotations: READ_ONLY,
        },
        async ({ direccion, pagina }) => {
            try {
                return json(await open(session, direccion, pagina));
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "aula_search",
        {
            description:
                "Busca palabras en el aula virtual. Sirve en dos casos:\n" +
                "- La pregunta no dice en qué materia está algo, o cruza materias (\"¿en qué materia se ve " +
                "memoria virtual?\").\n" +
                "- El dato está en el texto de un aviso o de una discusión de foro (\"¿quién avisó que la " +
                "clase sería virtual?\", \"¿por qué se suspendió la consulta?\"). El `fragmento` suele traer " +
                "la respuesta sin abrir nada.\n\n" +
                "Si la pregunta nombra la materia y lo que busca es material, una tarea, un cuestionario o " +
                "una fecha del cronograma, conviene navegar: aula_open del curso muestra sus secciones y " +
                "actividades, y abrir la sección que corresponde suele alcanzar. Buscar ahí suele costar " +
                "más llamadas: un resultado trae el nombre pero no los detalles (duración, vencimiento, " +
                "archivos), y hay que abrirlo igual. No conviene repetir la búsqueda con otras palabras " +
                "cuando ya se sabe el curso: es mejor abrirlo.\n\n" +
                "Busca en los nombres y textos de secciones y módulos (incluidas las etiquetas), en los " +
                "nombres de los archivos y en las discusiones de los foros (las 50 más recientes de cada " +
                "foro, con asunto y primer mensaje). No busca dentro de los archivos: para eso, leerlos con " +
                "aula_read_file. Tienen que aparecer todas las palabras; no importan mayúsculas ni tildes.\n\n" +
                "Cada resultado trae su `direccion` para abrirlo con aula_open, el `curso`, la `seccion` o el " +
                "`foro` donde está y un `fragmento` del texto alrededor de la coincidencia (no viene cuando " +
                "la coincidencia es en el nombre). Si no hay resultados, probar con menos palabras o con " +
                "sinónimos: los docentes nombran las cosas a su manera. Buscar en todos los cursos tarda " +
                "varios segundos.",
            inputSchema: z.object({
                consulta: z
                    .string()
                    .describe('Palabras a buscar, todas deben aparecer. Ej: "parcial recuperatorio", "memoria virtual".'),
                curso: z
                    .string()
                    .optional()
                    .describe(
                        "Dirección de un curso para buscar solo ahí, sacada de aula_list_courses. Ej: " +
                            '"/curso/3082". Sin este parámetro se buscan todos los cursos.',
                    ),
            }),
            annotations: READ_ONLY,
        },
        async ({ consulta, curso }) => {
            try {
                return json(await search(session, consulta, curso));
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "aula_list_upcoming",
        {
            description:
                "Lo que viene en el aula virtual, de todas las materias en una llamada: qué hay que entregar " +
                "o resolver y cuándo. Es la tool para \"¿qué tengo que entregar esta semana?\", \"¿cuándo " +
                "cierra el cuestionario?\" o \"¿qué tengo pendiente?\".\n\n" +
                "`pendientes` es la línea de tiempo de Moodle: tareas sin entregar, cuestionarios por cerrar, " +
                "elecciones sin responder; lo que el usuario ya completó no aparece. Cada uno trae `curso`, " +
                "`tipo` (assign, quiz…), `fecha` (el vencimiento o el cierre), `accion` (lo que hay que hacer) y " +
                "su `direccion` para abrirlo con aula_open y ver los detalles. Incluye lo vencido en las " +
                "últimas dos semanas que todavía figura como pendiente, con `vencida`. `disponible: false` " +
                "quiere decir que todavía no se puede hacer, por ejemplo un cuestionario que no abrió.\n\n" +
                "`eventos` es el resto del calendario en el rango: aperturas de cuestionarios, clases, eventos " +
                "que cargó el docente para el curso (con su `detalle`) y recordatorios personales. Un cierre o " +
                "vencimiento que está en `eventos` y no en `pendientes` es de algo que el usuario ya hizo o que " +
                "Moodle no le pide.\n\n" +
                "Solo ve lo que los docentes cargaron con fecha en el aula. Una fecha que está únicamente en " +
                "el texto de una etiqueta o en un cronograma en PDF no aparece: para eso, aula_search o abrir " +
                "el curso.",
            inputSchema: z.object({
                dias: z
                    .number()
                    .int()
                    .min(1)
                    .max(MAX_DAYS)
                    .optional()
                    .describe(`Cuántos días hacia adelante mirar. Por defecto, ${DEFAULT_DAYS}. Ej: 7 para esta semana.`),
                curso: z
                    .string()
                    .optional()
                    .describe(
                        'Dirección de un curso para ver solo ese, de aula_list_courses. Ej: "/curso/3082". Sin ' +
                            "este parámetro, todos los cursos.",
                    ),
            }),
            annotations: READ_ONLY,
        },
        async ({ dias, curso }) => {
            try {
                return json(await upcoming(session, { days: dias, course: curso }));
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "aula_read_file",
        {
            description:
                "Lee un archivo del aula virtual: PDF, Word (docx), PowerPoint (pptx), Excel (xlsx), imágenes y " +
                "texto. Los PDF escaneados se devuelven como imagen de cada página.\n\n" +
                "Devuelve el archivo por partes (páginas, diapositivas o fragmentos), tantas como entren en una " +
                "respuesta. Si quedan más, `siguiente` dice desde cuál pedir; también se puede saltar directo " +
                "a una parte con `desde`.\n\n" +
                "Formatos que no sabe leer (.doc, .ppt viejos, .zip, .rar, videos): devuelve un error con la URL " +
                "para que el usuario lo baje.",
            inputSchema: z.object({
                url: z.string().describe("La `url` del archivo tal como la devuelve aula_open."),
                desde: z
                    .number()
                    .int()
                    .min(1)
                    .optional()
                    .describe("Número de página, diapositiva o fragmento desde el cual leer. Por defecto, 1."),
            }),
            annotations: READ_ONLY,
        },
        async ({ url, desde }) => {
            try {
                const { parts, ...fileRead } = await readAulaFile(session, url, desde);
                const label = (n: number, title?: string) =>
                    `--- ${fileRead.unidad} ${n} de ${fileRead.total}${title ? ` (${title})` : ""} ---`;
                return {
                    content: [
                        { type: "text" as const, text: JSON.stringify(fileRead) },
                        ...parts.flatMap((p) =>
                            "text" in p
                                ? [{ type: "text" as const, text: `${label(p.number, p.title)}\n${p.text}` }]
                                : [
                                      { type: "text" as const, text: label(p.number, p.title) },
                                      {
                                          type: "image" as const,
                                          data: Buffer.from(p.image).toString("base64"),
                                          mimeType: p.mimeType,
                                      },
                                  ],
                        ),
                    ],
                };
            } catch (e) {
                return failure(e);
            }
        },
    );

    // --- Escritura: estas tools modifican el aula, y casi todo lo que hacen lo ven otras personas. ---

    const CONFIRM_FIRST =
        "\n\nAntes de llamarla, mostrale al usuario exactamente lo que se va a hacer y esperá que confirme.";

    server.registerTool(
        "aula_forum_post",
        {
            description:
                "Publica en un foro del aula virtual. Con la `direccion` de un foro abre un hilo nuevo (hace " +
                "falta `asunto`); con la de una discusión responde en ella, a la publicación `respuestaA` o, " +
                "si no se indica, a la primera.\n\n" +
                "Lo que se publica lo ven docentes y compañeros, y a muchos les llega por mail. Antes de abrir " +
                "un hilo, mirá `puedeAbrirHilo` del foro; antes de responder, que la publicación tenga " +
                '"responder" en `acciones`.' +
                CONFIRM_FIRST,
            inputSchema: z.object({
                direccion: z
                    .string()
                    .describe(
                        'Dirección de un foro o de una discusión. Ej: "/curso/691/mod/34831" o ' +
                            '"/curso/691/mod/34831/disc/416676".',
                    ),
                mensaje: z
                    .string()
                    .min(1)
                    .describe(
                        "Texto del mensaje, en texto plano. Una línea en blanco separa párrafos. " +
                            'Ej: "Hola, ¿el parcial incluye la unidad 4?"',
                    ),
                asunto: z
                    .string()
                    .optional()
                    .describe(
                        'Obligatorio para abrir un hilo. En una respuesta, por defecto "Re: <asunto>". ' +
                            'Ej: "Consulta sobre el parcial".',
                    ),
                respuestaA: z
                    .number()
                    .int()
                    .optional()
                    .describe("Solo al responder: `id` de la publicación a la que se responde, de aula_open. Ej: 768118."),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        },
        async ({ direccion, mensaje, asunto, respuestaA }) => {
            try {
                return json(await postToForum(session, direccion, mensaje, asunto, respuestaA));
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "aula_forum_edit_post",
        {
            description:
                "Edita una publicación propia de un foro y reemplaza el mensaje completo. Solo se puede si la " +
                'publicación tiene "editar" en `acciones`: Moodle deja editar por un rato después de publicar.' +
                CONFIRM_FIRST,
            inputSchema: z.object({
                direccion: z
                    .string()
                    .describe('Dirección de la discusión donde está la publicación. Ej: "/curso/691/mod/34831/disc/416676".'),
                id: z.number().int().describe("`id` de la publicación, de aula_open. Ej: 768118."),
                mensaje: z
                    .string()
                    .min(1)
                    .describe('El mensaje nuevo completo, en texto plano; reemplaza al anterior. Ej: "Ya lo resolví, gracias."'),
                asunto: z
                    .string()
                    .optional()
                    .describe('Asunto nuevo. Si no se pasa, queda el que tenía. Ej: "Consulta sobre el parcial (resuelta)".'),
            }),
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
        },
        async ({ direccion, id, mensaje, asunto }) => {
            try {
                return json(await editForumPost(session, direccion, id, mensaje, asunto));
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "aula_forum_delete_post",
        {
            description:
                "Borra una publicación propia de un foro. No se puede deshacer. Solo se puede si tiene " +
                '"borrar" en `acciones`. Si es la primera publicación de la discusión, se borra la discusión ' +
                "entera." +
                CONFIRM_FIRST,
            inputSchema: z.object({
                direccion: z
                    .string()
                    .describe('Dirección de la discusión donde está la publicación. Ej: "/curso/691/mod/34831/disc/416676".'),
                id: z.number().int().describe("`id` de la publicación, de aula_open. Ej: 768118."),
            }),
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
        },
        async ({ direccion, id }) => {
            try {
                return json(await deleteForumPost(session, direccion, id));
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "aula_choice_answer",
        {
            description:
                'Responde una elección (choice: encuestas rápidas como "¿venís al parcial?") o una selección ' +
                "de grupos (choicegroup: anotarse en un grupo o comisión). Deja elegidas exactamente las " +
                "`opciones` pasadas y reemplaza la respuesta anterior; con una lista vacía la borra.\n\n" +
                "Las opciones salen de `eleccion` al abrir el módulo con aula_open. Muchas no dejan cambiar " +
                "la respuesta una vez dada (`puedeCambiar: false`), y las opciones `deshabilitada` están " +
                "completas. Devuelve cómo quedó la elección." +
                CONFIRM_FIRST,
            inputSchema: z.object({
                direccion: z.string().describe('Dirección del módulo. Ej: "/curso/29487/mod/1729113".'),
                opciones: z
                    .array(z.number().int())
                    .describe("`id` de las opciones a elegir. Ej: [31076]. Varias solo si la actividad lo permite."),
            }),
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
        },
        async ({ direccion, opciones }) => {
            try {
                return json(await answerChoice(session, direccion, opciones));
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "aula_send_message",
        {
            description:
                "Manda un mensaje privado por la mensajería del aula virtual a otro usuario, docente o " +
                "compañero. El `usuarioId` sale del `autorId` de un foro o una discusión abiertos con " +
                "aula_open: no lo inventes ni lo deduzcas del nombre. La respuesta trae el nombre del " +
                "destinatario." +
                CONFIRM_FIRST +
                " Incluí a quién va dirigido.",
            inputSchema: z.object({
                usuarioId: z.number().int().describe("Id del destinatario, del `autorId` de aula_open. Ej: 1066."),
                mensaje: z
                    .string()
                    .min(1)
                    .describe('Texto del mensaje, en texto plano. Ej: "Profe, ¿puedo rendir el recuperatorio el viernes?"'),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        },
        async ({ usuarioId, mensaje }) => {
            try {
                return json(await sendMessage(session, usuarioId, mensaje));
            } catch (e) {
                return failure(e);
            }
        },
    );

    // En STDIO el servidor toma el archivo del disco del usuario. En HTTP no puede, porque corre en
    // otra máquina: los archivos llegan por un link de subida que usan el agente o el usuario.
    const newFiles = files.local
        ? "Los archivos nuevos se pasan en `archivos` con su ruta absoluta en la compu del usuario."
        : "Los archivos nuevos no van en la llamada: primero pedí un link con aula_assign_upload_link, " +
          "subilos ahí y después pasá su id en `subida`.";

    if (!files.local) {
        const { inbox, owner } = files;
        server.registerTool(
            "aula_assign_upload_link",
            {
                description:
                    "Genera un link de un solo uso para subir los archivos de una entrega, que después se " +
                    "entregan con aula_assign_submit pasando el `subida` que devuelve. Vence en 30 minutos.\n\n" +
                    "Cómo subirlos:\n" +
                    "- Si podés ejecutar comandos y tenés el archivo (por ejemplo, uno que el usuario adjuntó o " +
                    "que está en su compu), subilo vos con el comando de `conTerminal`, cambiando la ruta. Va un " +
                    '`-F "archivos=@..."` por archivo, todos en el mismo comando. Responde JSON con lo recibido.\n' +
                    "- Si no, pasale el `url` al usuario: se abre en el navegador, también en el celu, y elige " +
                    "los archivos ahí. Esperá a que te diga que los subió.\n\n" +
                    "Subir al link no entrega nada. Cada link acepta una sola subida: si hay que cambiar los " +
                    "archivos, pedí otro link. " +
                    "`acepta` trae los límites de la tarea.",
                inputSchema: z.object({
                    direccion: z
                        .string()
                        .describe('Dirección de la tarea, de aula_open. Ej: "/curso/29487/mod/1729138".'),
                }),
                annotations: { readOnlyHint: true, openWorldHint: false },
            },
            async ({ direccion }) => {
                try {
                    return json(await createUploadLink(session, direccion, inbox, owner));
                } catch (e) {
                    return failure(e);
                }
            },
        );
    }

    const submitSchema = z.object({
        direccion: z.string().describe('Dirección de la tarea, de aula_open. Ej: "/curso/29487/mod/1729138".'),
        archivos: z
            .array(z.string())
            .optional()
            .describe(
                files.local
                    ? "Lista final de archivos. Cada uno es la ruta absoluta de un archivo en la compu del " +
                          "usuario o la `url` de uno que ya está en la entrega. Lista vacía: quita todos. " +
                          'Ej: ["C:\\Users\\ana\\Documents\\TP3.pdf"].'
                    : "Lista final de los archivos que ya están en la entrega, por su `url` de aula_open; los " +
                          "de `subida` se suman. Lista vacía: quita los que estaban. " +
                          'Ej: ["https://virtual.unju.edu.ar/pluginfile.php/123/assignsubmission_file/submission_files/456/TP3.pdf"].',
            ),
        texto: z
            .string()
            .optional()
            .describe(
                "Texto en línea completo, en texto plano; reemplaza al anterior. Una línea en blanco " +
                    'separa párrafos. Ej: "Link al repositorio: https://github.com/ana/tp3"',
            ),
        enviar: z
            .boolean()
            .optional()
            .describe(
                "Solo en tareas con borradores: confirmar el envío para que cuente como entregada. Por " +
                    "defecto, true. Ej: false para dejarla como borrador.",
            ),
        aceptoDeclaracion: z
            .boolean()
            .optional()
            .describe(
                "true si el usuario aceptó la `declaracion` de la tarea. Solo hace falta si la tarea la pide. Ej: true.",
            ),
    });
    const httpSubmitSchema = submitSchema.extend({
        subida: z
            .string()
            .optional()
            .describe(
                "`subida` de aula_assign_upload_link, ya usado: sus archivos se suman a la entrega. " +
                    'Ej: "q3Vx9kP2mW7tR1yZ8nB4cD6fG0hJ5lA".',
            ),
    });

    server.registerTool(
        "aula_assign_submit",
        {
            description:
                "Entrega una tarea (assign) del aula virtual: sube archivos, escribe el texto en línea o las " +
                "dos cosas, según lo que acepte la tarea. Antes, abrila con aula_open: `entrega` dice qué " +
                "acepta (`acepta`, con tipos, cantidad y tamaño), si `puedeEditar` y lo que ya está subido.\n\n" +
                newFiles +
                " `archivos` es la lista final y reemplaza lo anterior: para sumar uno sin perder los otros, " +
                "incluí la `url` de cada archivo que ya está en la entrega. Si no pasás `archivos`, quedan " +
                "los que estaban; lo mismo con `texto`.\n\n" +
                "Si la tarea no usa borradores, guardar ya es entregar. Si los usa (`requiereConfirmarEnvio`), " +
                "la tool además confirma el envío, salvo con `enviar: false`; una vez enviada, en general no se " +
                "puede cambiar. Con `declaracion`, el usuario tiene que aceptarla (`aceptoDeclaracion`). " +
                "Devuelve cómo quedó la entrega." +
                CONFIRM_FIRST +
                " Incluí la tarea, los nombres de los archivos y si se confirma el envío.",
            // `subida` solo existe en HTTP; el cast deja que el handler la reciba en ambos modos.
            inputSchema: (files.local ? submitSchema : httpSubmitSchema) as typeof httpSubmitSchema,
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
        },
        async ({ direccion, archivos, subida, texto, enviar, aceptoDeclaracion }) => {
            try {
                return json(
                    await submitAssignment(
                        session,
                        direccion,
                        {
                            files: archivos,
                            upload: subida,
                            text: texto,
                            send: enviar ?? true,
                            acceptStatement: aceptoDeclaracion ?? false,
                        },
                        files,
                    ),
                );
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "aula_calendar_add_event",
        {
            description:
                "Agrega un evento personal al calendario del aula virtual, que solo ve el usuario: por ejemplo " +
                "un recordatorio de un parcial o una entrega. El aula avisa según la configuración de " +
                "notificaciones del usuario. La fecha va con zona horaria; en Argentina es -03:00.",
            inputSchema: z.object({
                nombre: z.string().min(1).describe('Título del evento. Ej: "Parcial de Física II".'),
                inicio: z
                    .string()
                    .describe('Fecha y hora en ISO 8601 con zona horaria. Ej: "2026-10-14T18:00:00-03:00".'),
                duracionMinutos: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe("Duración en minutos. Por defecto, sin duración. Ej: 120."),
                descripcion: z.string().optional().describe('Detalle, en texto plano. Ej: "Aula 312, unidades 1 a 4".'),
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        async ({ nombre, inicio, duracionMinutos, descripcion }) => {
            try {
                return json(
                    await addCalendarEvent(session, {
                        name: nombre,
                        start: inicio,
                        durationMinutes: duracionMinutos,
                        description: descripcion,
                    }),
                );
            } catch (e) {
                return failure(e);
            }
        },
    );
}
