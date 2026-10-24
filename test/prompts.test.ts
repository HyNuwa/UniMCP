/**
 * Prompts de MCP: recetas que encadenan tools que existen.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { WEEK_PLAN_TOOLS } from "../src/aula-virtual/prompts.js";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import type { GuaraniSession } from "../src/guarani/client/session.js";
import { createServer, type Platforms } from "../src/mcp-server.js";

const aula = { site: { baseUrl: "https://aula.test" } } as AulaSession;
const guarani = { site: { baseUrl: "https://guarani.test" } } as GuaraniSession;

/** Conecta un cliente y devuelve una función para mandarle pedidos. */
async function connect(platforms: Platforms) {
    const [client, transport] = InMemoryTransport.createLinkedPair();
    await createServer(platforms, { local: true }).connect(transport);
    const pending = new Map<number, (r: unknown) => void>();
    client.onmessage = (m) => {
        const { id, result } = m as { id?: number; result?: unknown };
        if (id !== undefined) pending.get(id)?.(result);
    };
    await client.start();
    let next = 1;
    const request = <T>(method: string, params: object = {}) =>
        new Promise<T>((resolve) => {
            const id = next++;
            pending.set(id, resolve as (r: unknown) => void);
            void client.send({ jsonrpc: "2.0", id, method, params });
        });
    await request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
    });
    await client.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return { request, close: () => client.close() };
}

describe("prompts", () => {
    test("aula_plan_semana encadena tools que el servidor tiene", async () => {
        const { request, close } = await connect({ aula, guarani });
        const { prompts } = await request<{ prompts: { name: string }[] }>("prompts/list");
        assert.deepEqual(prompts.map((p) => p.name), ["aula_plan_semana"]);

        const { messages } = await request<{ messages: { content: { text: string } }[] }>("prompts/get", {
            name: "aula_plan_semana",
        });
        const { tools } = await request<{ tools: { name: string }[] }>("tools/list");
        for (const name of WEEK_PLAN_TOOLS) {
            assert.ok(messages[0].content.text.includes(name), `El prompt no nombra ${name}`);
            assert.ok(tools.some((t) => t.name === name), `${name} no es una tool`);
        }
        await close();
    });

    test("sin aula no hay prompts del aula", async () => {
        const { request, close } = await connect({ guarani });
        const result = await request<{ prompts?: { name: string }[] }>("prompts/list");
        assert.ok(!result?.prompts?.some((p) => p.name.startsWith("aula_")));
        await close();
    });
});
