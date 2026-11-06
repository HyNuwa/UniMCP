import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loginAula } from "./aula-virtual/login.js";
import { loginGuarani } from "./guarani/login.js";
import { CUSTOM_CAMPUS, findCampus, listCampuses, localCampus, searchCampuses, type Campus } from "./shared/campus.js";
import { ask } from "./shared/input.js";
import { logger } from "./shared/logger.js";
import { campusFile } from "./shared/paths.js";

/**
 * `unimcp login`: elige el campus y entra a cada plataforma que tenga. Con `--http` solo el
 * aula, porque el modo HTTP no guarda contraseñas y la sesión de Guaraní no se renueva sin ellas.
 */
export async function runLogin(http: boolean): Promise<void> {
    const campus = process.env.UNI_CAMPUS?.trim() ? localCampus()! : await chooseCampus(http);
    logger.info(`Campus: ${campus.universidad} · ${campus.nombre}`);

    let accessToken: string | null = null;
    if (campus.aula) accessToken = await loginAula(campus, http);

    if (campus.guarani && !http) {
        const answer = (await ask("¿Configurar también SIU Guaraní? [S/n]: ")).trim().toLowerCase();
        if (answer !== "n" && answer !== "no") await loginGuarani(campus);
    } else if (campus.guarani) {
        logger.info("SIU Guaraní no está disponible en modo HTTP todavía: usalo por STDIO.");
    }

    await saveCampus(campus);

    if (accessToken) {
        logger.info(
            "Listo. Configurá tu cliente MCP con este header; no se vuelve a mostrar:\n\n" +
                `    Authorization: Bearer ${accessToken}\n`,
        );
    } else {
        logger.info("Listo: ya podés usar el servidor MCP.");
    }
}

/** Rondas de búsqueda antes de rendirse y decir cómo seguir si el campus no está. */
const MAX_ROUNDS = 5;

/**
 * Busca el campus por sigla, facultad o provincia y lista lo que coincide, agrupado por provincia, para
 * elegir por número o id. Con el registro largo, listarlo entero ya no entra en una pantalla.
 */
async function chooseCampus(http: boolean): Promise<Campus> {
    // En HTTP el usuario se identifica con el aula: un campus sin aula no sirve.
    const options = listCampuses().filter((c) => !http || c.aula);
    for (let round = 0; round < MAX_ROUNDS; round++) {
        const query = await ask("Buscá tu facultad: sigla, nombre o provincia (Ej: UNC, exactas, Córdoba). Enter para verlas todas: ");
        const exact = findCampus(query);
        if (query && exact && options.includes(exact)) return exact;

        // Por provincia, para que cada una aparezca una vez; dentro de ella, en el orden del registro.
        const matches = searchCampuses(query, options).sort((x, y) => (x.provincia ?? "").localeCompare(y.provincia ?? "", "es"));
        if (!matches.length) {
            logger.info(`No encontré "${query}". Probá con otra palabra, o Enter para ver todas.`);
            continue;
        }
        logger.info(campusList(matches));
        if (matches.length === 1) {
            const answer = (await ask("¿Es la tuya? [S/n]: ")).toLowerCase();
            if (answer !== "n" && answer !== "no") return matches[0];
            continue;
        }
        const answer = await ask("Elegí el número o el id (Enter para buscar de nuevo): ");
        if (!answer) continue;
        const campus = matches[Number(answer) - 1] ?? findCampus(answer);
        if (campus && options.includes(campus)) return campus;
        logger.info(`"${answer}" no es uno de la lista.`);
    }
    throw new Error(
        "No elegiste un campus. Si el tuyo no está, definí UNI_AULA_BASE_URL (y UNI_GUARANI_URL) y elegí " +
            `"${CUSTOM_CAMPUS}", o pedilo en https://github.com/HyNuwa/UniMCP/issues/new/choose.`,
    );
}

/** Los campus numerados, bajo el nombre de su provincia. */
export function campusList(campuses: readonly Campus[]): string {
    const lines: string[] = [];
    let province: string | undefined;
    campuses.forEach((c, i) => {
        const here = c.provincia ?? "Otros";
        if (here !== province) lines.push(`${lines.length ? "\n" : ""}${here}`);
        province = here;
        const platforms = [c.aula && "aula", c.guarani && "guaraní"].filter(Boolean).join(" + ");
        lines.push(`  ${String(i + 1).padStart(2)}. ${c.universidad} · ${c.nombre}  [${c.id}: ${platforms}]`);
    });
    return lines.join("\n");
}

/** El campus elegido queda en la carpeta de config: el servidor local lo lee al arrancar. */
async function saveCampus(campus: Campus): Promise<void> {
    const file = campusFile();
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ campus: campus.id }, null, 2));
}
