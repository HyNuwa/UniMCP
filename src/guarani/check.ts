import type { GuaraniSite } from "../shared/campus.js";
import { withoutIds } from "../shared/logger.js";
import type { GuaraniSession } from "./client/session.js";
import { openMenu } from "./format/page.js";

/**
 * La parte de Guaraní de `unimcp check`: si entra y cuántas operaciones tiene el menú. Sin datos
 * personales: ni el nombre de la propuesta ni las operaciones.
 */
export async function checkGuarani(site: GuaraniSite, session: GuaraniSession): Promise<string[]> {
    const lines = [`- URL: ${site.baseUrl}`];
    try {
        const menu = await openMenu(session);
        lines.push(
            "- Login: anda",
            `- Operaciones en el menú: ${menu.operaciones.length}`,
            `- Propuesta activa: ${menu.propuesta ? "sí" : "no se encontró el selector"}` +
                (menu.otrasPropuestas ? ` · ${menu.otrasPropuestas.length} más` : ""),
        );
    } catch (e) {
        lines.push(`- Login o menú: **falló** (${withoutIds((e as Error).message)})`);
    }
    return lines;
}
