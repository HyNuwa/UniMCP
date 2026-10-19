import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loginAula } from "./aula-virtual/login.js";
import { loginGuarani } from "./guarani/login.js";
import { findCampus, listCampuses, localCampus, type Campus } from "./shared/campus.js";
import { ask } from "./shared/input.js";
import { logger } from "./shared/logger.js";
import { campusFile } from "./shared/paths.js";

/**
 * `mcp-uni-arg login`: elige el campus y entra a cada plataforma que tenga. Con `--http` solo el
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

/** Lista el registro numerado y acepta el número o el id. */
async function chooseCampus(http: boolean): Promise<Campus> {
    // En HTTP el usuario se identifica con el aula: un campus sin aula no sirve.
    const options = listCampuses().filter((c) => !http || c.aula);
    const lines = options.map((c, i) => {
        const platforms = [c.aula && "aula", c.guarani && "guaraní"].filter(Boolean).join(" + ");
        return `  ${String(i + 1).padStart(2)}. ${c.universidad} · ${c.nombre}  [${c.id}: ${platforms}]`;
    });
    logger.info(`Campus disponibles:\n${lines.join("\n")}`);

    const answer = (await ask("Elegí tu campus (número o id): ")).trim();
    const byNumber = options[Number(answer) - 1];
    const campus = byNumber ?? findCampus(answer);
    if (!campus || (http && !campus.aula)) {
        throw new Error(
            `"${answer}" no es un campus de la lista. Si el tuyo no está, definí UNI_AULA_BASE_URL ` +
                "(y UNI_GUARANI_URL) y elegí \"personalizado\".",
        );
    }
    return campus;
}

/** El campus elegido queda en la carpeta de config: el servidor local lo lee al arrancar. */
async function saveCampus(campus: Campus): Promise<void> {
    const file = campusFile();
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ campus: campus.id }, null, 2));
}
