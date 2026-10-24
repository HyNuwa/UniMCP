/**
 * `unimcp check`: dice qué tools andan en el aula del usuario, y lo que escribe se pega en un issue
 * público, así que no lleva datos personales.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, test } from "node:test";
import type { McpServer } from "@modelcontextprotocol/server";
import { checkAula, TOOL_FUNCTIONS } from "../src/aula-virtual/check.js";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { registerAulaVirtualTools } from "../src/aula-virtual/tools.js";
import { redact } from "../src/check.js";
import { withoutIds } from "../src/shared/logger.js";
import { UploadInbox } from "../src/shared/uploads.js";

const site = { baseUrl: "https://aula.test" };
const session: AulaSession = { site, getToken: async () => "tok", refreshToken: async () => "tok" };

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

/** Los nombres de las tools del aula, por STDIO y por HTTP. */
function aulaTools(): Set<string> {
    const names = new Set<string>();
    const server = {
        registerTool(name: string) {
            names.add(name);
            return {};
        },
    } as unknown as McpServer;
    registerAulaVirtualTools(server, session, { local: true });
    const hosted = { local: false as const, inbox: new UploadInbox("https://mcp.test"), owner: "1" };
    registerAulaVirtualTools(server, session, hosted);
    return names;
}

/** Funciones del cliente que no usa ninguna tool, con el motivo. */
const NOT_TOOLS: Record<string, string> = {
    core_webservice_get_site_info: "La usan todas para el userid; sin ella no hay login.",
    core_user_get_users_by_field: "El email del usuario, al vincular la cuenta en el modo HTTP.",
    tool_mobile_get_public_config: "La usa el propio check, sin token.",
};

describe("unimcp check", () => {
    test("la tabla tiene cada tool del aula, y nada más", () => {
        assert.deepEqual(Object.keys(TOOL_FUNCTIONS).sort(), [...aulaTools()].sort());
    });

    test("cada función del cliente la usa alguna tool de la tabla", () => {
        const source = readFileSync(new URL("../src/aula-virtual/client/moodle.ts", import.meta.url), "utf8");
        const used = new Set(source.match(/"(core|mod|gradereport|tool)_[a-z_]+"/g)!.map((f) => f.slice(1, -1)));
        const inTable = new Set(
            Object.values(TOOL_FUNCTIONS).flatMap(({ needs, partial = {} }) => [...needs, ...Object.keys(partial)]),
        );
        const missing = [...used].filter((f) => !inTable.has(f) && !(f in NOT_TOOLS));
        assert.deepEqual(missing, []);
    });

    test("dice qué tools andan, sin el usuario, su nombre ni sus cursos", async () => {
        const all = Object.values(TOOL_FUNCTIONS).flatMap(({ needs, partial = {} }) => [
            ...needs,
            ...Object.keys(partial),
        ]);
        const without = new Set(["gradereport_user_get_grade_items", "mod_assign_remove_submission"]);
        globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
            if (String(input).includes("service-nologin.php")) {
                return Response.json([{ error: false, data: { enablemobilewebservice: 1, typeoflogin: 1 } }]);
            }
            const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
            if (params.get("wsfunction") === "core_webservice_get_site_info") {
                return Response.json({
                    userid: 7,
                    username: "40123456",
                    fullname: "Ana Pérez",
                    release: "4.1.2",
                    functions: all.filter((f) => !without.has(f)).map((name) => ({ name, version: "1" })),
                });
            }
            return Response.json([{ id: 1, shortname: "MAT1", fullname: "Matemática I", visible: 1 }]);
        }) as typeof fetch;

        const out = (await checkAula(site, session)).join("\n");
        assert.match(out, /Servicio móvil: habilitado/);
        assert.match(out, /Moodle 4\.1\.2/);
        assert.match(out, /Cursos: 1/);
        assert.match(out, /✗ aula_list_grades: faltan gradereport_user_get_grade_items/);
        assert.match(out, /~ aula_assign_submit: anda, salvo borrar la entrega entera/);
        assert.match(out, /✓ aula_list_updates/);
        for (const personal of ["40123456", "Ana", "Pérez", "Matemática", "MAT1"]) {
            assert.ok(!out.includes(personal), personal);
        }
    });

    test("si el login falla, lo dice sin el DNI que traiga el error", async () => {
        globalThis.fetch = (async (input: string | URL) => {
            if (String(input).includes("service-nologin.php")) return Response.json([{ error: false, data: {} }]);
            return Response.json({ exception: "x", errorcode: "x", message: "El usuario 40.123.456 está suspendido" });
        }) as typeof fetch;
        // Otra sesión: la de arriba ya tiene el site_info guardado.
        const other: AulaSession = { ...session, getToken: async () => "tok-2" };
        const out = (await checkAula(site, other)).join("\n");
        assert.match(out, /Login: \*\*falló\*\* \(El usuario \[número\] está suspendido\)/);
    });

    test("tapa el usuario de las credenciales, y no los números que no son documentos", () => {
        assert.equal(redact("Login de ana.perez: falló", ["ana.perez"]), "Login de [usuario]: falló");
        assert.equal(withoutIds("DNI 40123456 · 40.123.456 · 2.345.678"), "DNI [número] · [número] · [número]");
        const notIds = "Moodle 3.9.25 · 387 funciones · aula 2023";
        assert.equal(withoutIds(notIds), notIds);
    });
});
