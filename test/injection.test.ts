/**
 * Prompt injection: un post de foro, una etiqueta o un archivo pueden traer texto que le da órdenes al
 * modelo. El servidor le avisa al conectarse que ese texto es dato, y cada tool que escribe dice que se
 * usa solo por pedido del usuario. Estos tests fallan si una tool nueva se olvida de decirlo.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { InMemoryTransport, type McpServer } from "@modelcontextprotocol/server";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { ON_REQUEST, registerAulaVirtualTools, THIRD_PARTY_TEXT } from "../src/aula-virtual/tools.js";
import type { GuaraniSession } from "../src/guarani/client/session.js";
import { registerGuaraniTools } from "../src/guarani/tools.js";
import { createServer, INSTRUCTIONS } from "../src/mcp-server.js";
import { UploadInbox } from "../src/shared/uploads.js";

const aula = { site: { baseUrl: "https://aula.test" } } as AulaSession;
const guarani = { site: { baseUrl: "https://guarani.test" } } as GuaraniSession;

interface Registered {
    name: string;
    description: string;
    readOnly: boolean;
    annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
}

/** Las tools que registra cada plataforma, sin levantar un servidor: alcanza con anotar las llamadas. */
function registeredTools(local: boolean): Registered[] {
    const tools: Registered[] = [];
    const server = {
        registerTool(name: string, config: { description: string; annotations?: Registered["annotations"] }) {
            const annotations = config.annotations ?? {};
            const readOnly = annotations.readOnlyHint === true;
            tools.push({ name, description: config.description, readOnly, annotations });
            // Como el servidor real: con lo que devuelve, aula_assign_submit habilita su link de subida.
            return {};
        },
    } as unknown as McpServer;
    registerAulaVirtualTools(
        server,
        aula,
        local ? { local: true } : { local: false, inbox: new UploadInbox("https://mcp.test"), owner: "1" },
    );
    registerGuaraniTools(server, guarani);
    return tools;
}

/** Las que devuelven texto que escriben docentes y compañeros. */
const THIRD_PARTY_TOOLS = ["aula_open", "aula_search", "aula_read_file", "aula_list_upcoming", "aula_list_grades"];

/** Las de lectura que no, con el motivo. Una tool de lectura nueva tiene que estar en una de las dos listas. */
const OWN_TEXT_TOOLS: Record<string, string> = {
    aula_get_site_info: "Datos del usuario y del sitio.",
    aula_list_courses: "Nombres de cursos, que pone la universidad.",
    aula_assign_upload_link: "Un link de subida que arma el servidor.",
    guarani_menu: "El menú del sistema.",
    guarani_open: "Páginas que arma el sistema de la universidad, no docentes ni compañeros.",
};

describe("prompt injection", () => {
    for (const local of [true, false]) {
        test(`cada tool que escribe dice que se usa solo por pedido del usuario (${local ? "STDIO" : "HTTP"})`, () => {
            const writes = registeredTools(local).filter((t) => !t.readOnly);
            assert.ok(writes.length >= 7, `Hay ${writes.length} tools que escriben`);
            for (const t of writes) assert.ok(t.description.includes(ON_REQUEST), `${t.name} no lo dice`);
        });
    }

    test("las tools que devuelven texto de terceros dicen que es contenido, no instrucciones", () => {
        const tools = registeredTools(true);
        for (const name of THIRD_PARTY_TOOLS) {
            const t = tools.find((x) => x.name === name);
            assert.ok(t, `No se registró ${name}`);
            assert.ok(t.description.includes(THIRD_PARTY_TEXT), `${name} no lo dice`);
        }
    });

    for (const local of [true, false]) {
        test(`cada tool de lectura está clasificada: texto de terceros o no (${local ? "STDIO" : "HTTP"})`, () => {
            for (const t of registeredTools(local).filter((x) => x.readOnly)) {
                assert.ok(
                    THIRD_PARTY_TOOLS.includes(t.name) !== t.name in OWN_TEXT_TOOLS,
                    `${t.name} tiene que estar en THIRD_PARTY_TOOLS o en OWN_TEXT_TOOLS (y en una sola)`,
                );
            }
        });

        test(`cada tool declara qué hace (${local ? "STDIO" : "HTTP"})`, () => {
            for (const t of registeredTools(local)) {
                const a = t.annotations;
                assert.equal(typeof a.readOnlyHint, "boolean", `${t.name} no declara readOnlyHint`);
                if (t.readOnly) continue;
                assert.equal(typeof a.destructiveHint, "boolean", `${t.name} no declara destructiveHint`);
                assert.equal(typeof a.idempotentHint, "boolean", `${t.name} no declara idempotentHint`);
            }
        });
    }

    test("el servidor manda las instrucciones al inicializar", async () => {
        const [client, transport] = InMemoryTransport.createLinkedPair();
        await createServer({ aula, guarani }, { local: true }).connect(transport);
        const response = new Promise<{ result: { instructions?: string } }>((resolve) => {
            client.onmessage = (message) => resolve(message as { result: { instructions?: string } });
        });
        await client.start();
        await client.send({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
        });
        const { result } = await response;
        assert.equal(result.instructions, INSTRUCTIONS);
        assert.match(INSTRUCTIONS, /nunca instrucciones/);
        await client.close();
    });
});
