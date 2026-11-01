// Saca de src/ lo que muestra la web: la versión, los campus y las tools, para que nunca se escriban a mano.
// Las tools se anotan como en scripts/pack-mcpb.mjs, sin levantar un servidor. Se registran en modo
// local y en HTTP porque algunas existen en uno solo (`aula_assign_upload_link`).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { listCampuses } from "../../src/shared/campus.js";
import { registerAulaVirtualTools } from "../../src/aula-virtual/tools.js";
import { registerGuaraniTools } from "../../src/guarani/tools.js";

type Tool = { name: string; plataforma: "aula" | "guarani"; escribe: boolean; descripcion: string };

const tools = new Map<string, Tool>();
const recorder = (plataforma: Tool["plataforma"]) => ({
    registerTool: (name: string, config: { description: string; annotations?: { readOnlyHint?: boolean } }) => {
        tools.set(name, {
            name,
            plataforma,
            escribe: config.annotations?.readOnlyHint !== true,
            descripcion: config.description.split(/(?<=\.)\s/)[0],
        });
        // tools.ts registra aula_assign_upload_link solo si recibió la tool de entrega registrada.
        return {};
    },
});
const site = { site: { baseUrl: "" } };
for (const local of [true, false]) registerAulaVirtualTools(recorder("aula") as never, site as never, { local } as never);
registerGuaraniTools(recorder("guarani") as never, site as never);

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const campus = listCampuses().map((c) => ({
    id: c.id,
    universidad: c.universidad,
    nombre: c.nombre,
    aula: Boolean(c.aula),
    sso: Boolean(c.aula?.ssoHost),
    guarani: Boolean(c.guarani),
}));

const out = new URL("../src/data/generated.json", import.meta.url);
mkdirSync(new URL(".", out), { recursive: true });
writeFileSync(out, JSON.stringify({ version: pkg.version, paquete: pkg.name, campus, tools: [...tools.values()] }, null, 2) + "\n");
console.log(`data: ${campus.length} campus, ${tools.size} tools, ${pkg.name}@${pkg.version}`);
