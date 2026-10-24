/**
 * Lo que el modelo lee de cada tool: todo parámetro dice qué es y trae un ejemplo concreto, porque sin
 * ejemplo el modelo adivina el formato (una `direccion`, una fecha, una página).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import type { GuaraniSession } from "../src/guarani/client/session.js";
import { createServer } from "../src/mcp-server.js";
import { UploadInbox } from "../src/shared/uploads.js";

const aula = { site: { baseUrl: "https://aula.test" } } as AulaSession;
const guarani = { site: { baseUrl: "https://guarani.test" } } as GuaraniSession;

interface Property {
    description?: string;
    items?: Property;
    properties?: Record<string, Property>;
}
interface ListedTool {
    name: string;
    inputSchema: { properties?: Record<string, Property> };
}

/** Las tools que ve un cliente, por STDIO o por HTTP. */
async function listTools(local: boolean): Promise<ListedTool[]> {
    const [client, transport] = InMemoryTransport.createLinkedPair();
    const files = local
        ? { local: true as const }
        : { local: false as const, inbox: new UploadInbox("https://mcp.test"), owner: "1" };
    await createServer({ aula, guarani }, files, "all").connect(transport);
    const results = new Map<number, (r: unknown) => void>();
    client.onmessage = (m) => {
        const { id, result } = m as { id?: number; result?: unknown };
        if (id !== undefined) results.get(id)?.(result);
    };
    await client.start();
    const request = <T>(id: number, method: string, params: object = {}) =>
        new Promise<T>((resolve) => {
            results.set(id, resolve as (r: unknown) => void);
            void client.send({ jsonrpc: "2.0", id, method, params });
        });
    await request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
    });
    await client.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const { tools } = await request<{ tools: ListedTool[] }>(2, "tools/list");
    await client.close();
    return tools;
}

/** Cada parámetro de la tool, con los campos de los objetos anidados (`archivos[].nombre`). */
function* parameters(properties: Record<string, Property> = {}, prefix = ""): Generator<[string, Property]> {
    for (const [name, property] of Object.entries(properties)) {
        yield [prefix + name, property];
        const nested = property.items?.properties ?? property.properties;
        if (nested) yield* parameters(nested, `${prefix}${name}${property.items ? "[]" : ""}.`);
    }
}

describe("descripciones de los parámetros", () => {
    for (const local of [true, false]) {
        test(`todas tienen un ejemplo (${local ? "STDIO" : "HTTP"})`, async () => {
            const missing: string[] = [];
            for (const tool of await listTools(local)) {
                for (const [name, property] of parameters(tool.inputSchema.properties)) {
                    if (!/\bEj: /.test(property.description ?? "")) missing.push(`${tool.name}.${name}`);
                }
            }
            assert.deepEqual(missing, [], "Parámetros sin `.describe()` con «Ej: …»");
        });
    }
});
