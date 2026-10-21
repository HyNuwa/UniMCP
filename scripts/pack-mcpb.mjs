// Arma la extensión de Claude Desktop (`unimcp-<versión>.mcpb`): un zip con el servidor compilado, sus
// dependencias de producción y mcpb/manifest.json, que se instala con doble click. Corre después de
// `npm run build` (`npm run mcpb` hace las dos cosas).
//
// La versión sale de package.json, y la lista de campus y de tools, del código compilado: así el manifest
// no queda desactualizado. Las credenciales llegan por variables de entorno, así que el binario nativo
// del keychain no hace falta en la extensión y da igual en qué sistema se arme.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Versión del CLI de mcpb, fija para que el paquete salga igual en cualquier máquina. */
const MCPB_CLI = "@anthropic-ai/mcpb@2.1.2";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "build-mcpb");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const built = (path) => import(pathToFileURL(join(root, "build", path)).href);

const { listCampuses, CUSTOM_CAMPUS } = await built("shared/campus.js");
const { registerAulaVirtualTools } = await built("aula-virtual/tools.js");
const { registerGuaraniTools } = await built("guarani/tools.js");

// Las tools se anotan sin levantar un servidor; cuáles aparecen depende del campus, por eso
// `tools_generated`. La descripción del manifest es la primera oración de la de la tool.
const tools = [];
const recorder = { registerTool: (name, config) => tools.push({ name, description: config.description.split(/(?<=\.)\s/)[0] }) };
registerAulaVirtualTools(recorder, { site: { baseUrl: "" } }, { local: true });
registerGuaraniTools(recorder, { site: { baseUrl: "" } });

const manifest = JSON.parse(readFileSync(join(root, "mcpb", "manifest.json"), "utf8"));
manifest.version = pkg.version;
manifest.tools = tools;
const campuses = listCampuses().map((c) => `${c.id} (${c.universidad}, ${c.nombre})`);
manifest.user_config.campus.description =
    `El id de tu campus: ${campuses.join("; ")}. Si el tuyo no está, escribí "${CUSTOM_CAMPUS}" y completá ` +
    "las URLs de abajo.";

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage);
for (const path of ["build", "vendor", "LICENSE", "README.md", "package.json", "package-lock.json"]) {
    cpSync(join(root, path), join(stage, path), { recursive: true });
}
writeFileSync(join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));

// Un solo comando de texto: en Windows npm y npx son .cmd y necesitan la shell.
const run = (command, cwd = root) => execSync(command, { cwd, stdio: "inherit" });
const output = join(root, `unimcp-${pkg.version}.mcpb`);
run("npm ci --omit=dev --ignore-scripts --no-audit --no-fund", stage);
run(`npx -y ${MCPB_CLI} validate "${join(stage, "manifest.json")}"`);
run(`npx -y ${MCPB_CLI} pack "${stage}" "${output}"`);
console.error(`Extensión lista: ${output}`);
