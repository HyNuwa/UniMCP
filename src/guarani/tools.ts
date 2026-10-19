import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { GuaraniSession } from "./client/session.js";
import { openMenu, openPage } from "./format/page.js";

// JSON compacto: indentar estas respuestas cuesta ~25% más de contexto y no se lee mejor.
const json = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
});

const failure = (e: unknown) => ({
    content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }],
    isError: true,
});

/** Solo lectura: inscribirse a materias o exámenes todavía no está implementado. */
const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

export function registerGuaraniTools(server: McpServer, session: GuaraniSession) {
    server.registerTool(
        "guarani_menu",
        {
            description:
                "Lista las operaciones de SIU Guaraní (autogestión) que la universidad habilitó para el usuario: " +
                "historia académica, plan de estudios, mis inscripciones, inscripción a materias y a exámenes, " +
                "fechas de examen, certificados, etc. Es el punto de entrada para todo lo académico-administrativo " +
                "(notas finales, correlativas, regularidades, mesas), que no está en el aula virtual.\n\n" +
                "Cada operación trae su `direccion`, que se le pasa a guarani_open. Los nombres los pone cada " +
                "universidad, así que buscá por sentido (\"Historia Académica\", \"Mis Inscripciones\", " +
                "\"Inscripción a Exámenes\"). `encabezado` trae el alumno y la propuesta (carrera) activa.",
            annotations: READ_ONLY,
        },
        async () => {
            try {
                return json(await openMenu(session));
            } catch (e) {
                return failure(e);
            }
        },
    );

    server.registerTool(
        "guarani_open",
        {
            description:
                "Abre una página de SIU Guaraní y devuelve su contenido como texto por sección, con las tablas " +
                "fila por fila y las celdas separadas por \" | \" (materia | fecha | nota | resultado, por ejemplo), " +
                "los `avisos` que muestra Guaraní y los `enlaces` a otras páginas, cada uno con su `direccion`.\n\n" +
                "No hace falta armar la dirección: sale de guarani_menu o de los `enlaces` de otra respuesta. Si " +
                "viene `recortado`, la página era más larga que lo que entra en una respuesta.\n\n" +
                "Solo lee: no inscribe ni da de baja. Si el usuario quiere inscribirse, pasale `urlParaUsuario` " +
                "para que lo haga desde el navegador.",
            inputSchema: {
                direccion: z
                    .string()
                    .describe(
                        'Dirección de una operación, tal como la devuelve guarani_menu o un enlace. Ej: "historia_academica". ' +
                            'Vacía ("") para la página de inicio.',
                    ),
            },
            annotations: READ_ONLY,
        },
        async ({ direccion }) => {
            try {
                return json(await openPage(session, direccion));
            } catch (e) {
                return failure(e);
            }
        },
    );
}
