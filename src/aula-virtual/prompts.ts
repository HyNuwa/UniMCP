import type { McpServer } from "@modelcontextprotocol/server";

/** Las tools que encadena el plan de la semana; `test/prompts.test.ts` revisa que existan. */
export const WEEK_PLAN_TOOLS = ["aula_list_upcoming", "aula_list_updates", "aula_list_grades"];

const WEEK_PLAN =
    "Armame un plan para esta semana con lo del aula virtual.\n\n" +
    "1. Con aula_list_upcoming (dias: 7), lo que tengo que entregar o resolver y para cuándo.\n" +
    "2. Con aula_list_updates (dias: 7), el material nuevo o cambiado en cada materia.\n" +
    "3. Con aula_list_grades, sin curso, cómo voy en cada materia y si me pusieron notas nuevas.\n\n" +
    "Ordená lo pendiente por fecha, marcá lo vencido y lo que todavía no se puede hacer, y decime qué " +
    "material nuevo conviene mirar antes de cada entrega. Si una de esas tools falla o no está, seguí con " +
    "las otras y contame qué faltó.";

/**
 * Recetas que el cliente muestra como comandos. Encadenan tools que ya existen, en lugar de una tool que
 * "piensa" y gasta contexto en cada llamada.
 */
export function registerAulaPrompts(server: McpServer) {
    server.registerPrompt(
        "aula_plan_semana",
        {
            title: "Plan de la semana",
            description: "Lo que tenés que entregar esta semana, lo nuevo en el aula y cómo vas en cada materia.",
        },
        () => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: WEEK_PLAN } }] }),
    );
}
