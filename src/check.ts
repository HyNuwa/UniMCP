import { checkAula } from "./aula-virtual/check.js";
import { LocalSession } from "./aula-virtual/client/local-session.js";
import { checkGuarani } from "./guarani/check.js";
import { LocalGuaraniSession } from "./guarani/client/local-session.js";
import { localCampus } from "./shared/campus.js";
import { loadCredentials, loginHint } from "./shared/credentials.js";
import { VERSION } from "./shared/version.js";

/**
 * `unimcp check`: prueba el campus elegido y escribe un resumen para pegar en el issue "Probé mi
 * universidad". No muestra datos personales, y por las dudas tapa el usuario de las credenciales y los
 * números con forma de DNI si algún mensaje de error los trae.
 */
export async function runCheck(): Promise<string> {
    const campus = localCampus();
    if (!campus) throw new Error(`Todavía no elegiste tu campus. ${loginHint("el campus")}`);

    const lines = [
        "### unimcp check",
        `- unimcp ${VERSION} · Node ${process.version} · ${process.platform}`,
        `- Campus: \`${campus.id}\` (${campus.universidad} · ${campus.nombre})`,
    ];
    if (campus.aula) {
        lines.push("", "#### Aula virtual", ...(await checkAula(campus.aula, new LocalSession(campus.aula))));
    }
    if (campus.guarani) {
        const session = new LocalGuaraniSession(campus.guarani);
        lines.push("", "#### SIU Guaraní", ...(await checkGuarani(campus.guarani, session)));
    }

    const usernames = await Promise.all([loadCredentials("aula"), loadCredentials("guarani")]);
    return redact(lines.join("\n"), usernames.flatMap((c) => (c?.username ? [c.username] : [])));
}

/** Tapa los usuarios de las credenciales donde aparezcan. */
export function redact(text: string, usernames: string[]): string {
    let out = text;
    for (const name of usernames) if (name.trim()) out = out.replaceAll(name.trim(), "[usuario]");
    return out;
}
