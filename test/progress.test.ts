/**
 * Avisos de progreso de MCP en las tools que recorren todos los cursos: si el cliente manda un
 * `progressToken`, recibe cuánto lleva; si no, nada.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { createServer } from "../src/mcp-server.js";

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

const COURSES = [1, 2, 3].map((id) => ({ id, shortname: `C${id}`, fullname: `Curso ${id}`, visible: 1 }));

/** Llama a aula_list_grades y devuelve los avisos de progreso que llegaron. */
async function gradesWithProgress(progressToken?: string) {
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        switch (params.get("wsfunction")) {
            case "core_webservice_get_site_info":
                return Response.json({ userid: 7, username: "ana", fullname: "Ana" });
            case "core_enrol_get_users_courses":
                return Response.json(COURSES);
        }
        return Response.json({ usergrades: [{ gradeitems: [] }] });
    }) as typeof fetch;
    const session: AulaSession = {
        site: { baseUrl: "https://aula.test" },
        getToken: async () => `tok-${progressToken}`,
        refreshToken: async () => "tok",
    };
    const [client, transport] = InMemoryTransport.createLinkedPair();
    await createServer({ aula: session }, { local: true }, "all").connect(transport);
    const notifications: { progress: number; total: number; message: string }[] = [];
    const results = new Map<number, (r: unknown) => void>();
    client.onmessage = (m) => {
        const { id, result, method, params } = m as { id?: number; result?: unknown; method?: string; params?: never };
        if (method === "notifications/progress") notifications.push(params!);
        if (id !== undefined) results.get(id)?.(result);
    };
    await client.start();
    const request = (id: number, method: string, params: object) =>
        new Promise<unknown>((resolve) => {
            results.set(id, resolve);
            void client.send({ jsonrpc: "2.0", id, method, params });
        });
    await request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
    });
    await request(2, "tools/call", {
        name: "aula_list_grades",
        arguments: {},
        ...(progressToken && { _meta: { progressToken } }),
    });
    await client.close();
    return notifications;
}

test("con progressToken, un aviso por curso, siempre creciendo hasta el total", async () => {
    const notifications = await gradesWithProgress("p1");
    assert.deepEqual(
        notifications.map((n) => [n.progress, n.total]),
        [
            [1, 3],
            [2, 3],
            [3, 3],
        ],
    );
    assert.ok(notifications.every((n) => n.message === "cursos"));
});

test("sin progressToken no se manda nada", async () => {
    assert.deepEqual(await gradesWithProgress(), []);
});
