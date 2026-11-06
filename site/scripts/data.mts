// Saca de src/ lo que muestra la web: la versión, los campus y las tools, para que nunca se escriban a mano.
// Las tools se anotan como en scripts/pack-mcpb.mjs, sin levantar un servidor. Se registran en modo
// local y en HTTP porque algunas existen en uno solo (`aula_assign_upload_link`).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { listCampuses } from "../../src/shared/campus.js";
import { registerAulaVirtualTools } from "../../src/aula-virtual/tools.js";
import { registerGuaraniTools } from "../../src/guarani/tools.js";
import { checkedCampus, TESTED_THREAD } from "../../src/shared/community.js";

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
    provincia: c.provincia ?? "",
    aula: Boolean(c.aula),
    sso: Boolean(c.aula?.ssoHost),
    guarani: Boolean(c.guarani),
}));

type Comment = { author: { login: string } | null; isMinimized: boolean; body: string };

/**
 * Quienes pegaron su `unimcp check` en el hilo, por campus. Se saltean los comentarios ocultos (moderados), los
 * que no son un resumen y los de un campus que no existe. GraphQL siempre pide token: sin GITHUB_TOKEN, nadie.
 */
async function testedBy(validIds: Set<string>): Promise<Record<string, string[]>> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        console.log("data: sin GITHUB_TOKEN, el mapa sale sin quienes lo probaron");
        return {};
    }
    const query = `query($n: Int!, $after: String) { repository(owner: "HyNuwa", name: "UniMCP") { discussion(number: $n) {
        comments(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { author { login } isMinimized body } } } } }`;
    const byCampus = new Map<string, Set<string>>();
    let after: string | null = null;
    // Un tope de páginas por si el hilo crece mucho: 10 × 100 comentarios.
    for (let page = 0; page < 10; page++) {
        const res = await fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify({ query, variables: { n: TESTED_THREAD.number, after } }),
        });
        const json = (await res.json().catch(() => undefined)) as
            | { data?: { repository?: { discussion?: { comments: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: Comment[] } } } } }
            | undefined;
        const comments = json?.data?.repository?.discussion?.comments;
        if (!res.ok || !comments) {
            console.log(`data: no pude leer el hilo (${res.status}), el mapa sale sin quienes lo probaron`);
            return {};
        }
        for (const c of comments.nodes) {
            const id = checkedCampus(c.body);
            if (!c.author || c.isMinimized || !id || !validIds.has(id)) continue;
            byCampus.set(id, (byCampus.get(id) ?? new Set()).add(c.author.login));
        }
        if (!comments.pageInfo.hasNextPage) break;
        after = comments.pageInfo.endCursor;
    }
    return Object.fromEntries([...byCampus].map(([id, logins]) => [id, [...logins]]));
}

const probaron = await testedBy(new Set(campus.map((c) => c.id)));

const out = new URL("../src/data/generated.json", import.meta.url);
mkdirSync(new URL(".", out), { recursive: true });
writeFileSync(out, JSON.stringify({ version: pkg.version, paquete: pkg.name, hilo: TESTED_THREAD.url, campus, probaron, tools: [...tools.values()] }, null, 2) + "\n");
const testers = new Set(Object.values(probaron).flat()).size;
console.log(`data: ${campus.length} campus, ${tools.size} tools, ${testers} probaron, ${pkg.name}@${pkg.version}`);
