/**
 * `UNIMCP_WRITE_TOOLS`: qué tools que escriben existen. Las que no están permitidas no se registran, así
 * que no se listan ni se pueden llamar.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import type { GuaraniSession } from "../src/guarani/client/session.js";
import { createServer } from "../src/mcp-server.js";
import type { FileSource } from "../src/shared/uploads.js";
import { UploadInbox } from "../src/shared/uploads.js";
import { type WritePolicy, writePolicyFromEnv } from "../src/shared/write-policy.js";

const aula = { site: { baseUrl: "https://aula.test" } } as AulaSession;
const guarani = { site: { baseUrl: "https://guarani.test" } } as GuaraniSession;
const LOCAL: FileSource = { local: true };
const HTTP: FileSource = { local: false, inbox: new UploadInbox("https://mcp.test"), owner: "1" };

interface Listed {
    name: string;
    annotations?: { readOnlyHint?: boolean };
}

/** Las tools que ve un cliente, pedidas con `tools/list`. */
async function listTools(files: FileSource, policy?: WritePolicy): Promise<Listed[]> {
    const [client, transport] = InMemoryTransport.createLinkedPair();
    await createServer({ aula, guarani }, files, policy).connect(transport);
    const responses = new Map<number, (r: unknown) => void>();
    client.onmessage = (m) => {
        const { id, result } = m as { id?: number; result?: unknown };
        if (id !== undefined) responses.get(id)?.(result);
    };
    await client.start();
    const request = (id: number, method: string, params: object) =>
        new Promise<unknown>((resolve) => {
            responses.set(id, resolve);
            void client.send({ jsonrpc: "2.0", id, method, params });
        });
    await request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
    });
    await client.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const { tools } = (await request(2, "tools/list", {})) as { tools: Listed[] };
    await client.close();
    return tools;
}

const writeNames = (tools: Listed[]) =>
    tools.filter((t) => t.annotations?.readOnlyHint !== true).map((t) => t.name).sort();

describe("UNIMCP_WRITE_TOOLS", () => {
    test("sin definir: todas en STDIO, ninguna en HTTP", () => {
        assert.equal(writePolicyFromEnv(true, undefined), "all");
        assert.deepEqual(writePolicyFromEnv(false, undefined), new Set());
        assert.deepEqual(writePolicyFromEnv(false, "  "), new Set());
    });

    test("all, none o una lista separada por comas o espacios", () => {
        assert.equal(writePolicyFromEnv(false, "all"), "all");
        assert.deepEqual(writePolicyFromEnv(true, "none"), new Set());
        assert.deepEqual(
            writePolicyFromEnv(false, "aula_forum_post, aula_send_message aula_assign_submit"),
            new Set(["aula_forum_post", "aula_send_message", "aula_assign_submit"]),
        );
        assert.throws(() => writePolicyFromEnv(false, "all,aula_forum_post"), /no las dos cosas/);
    });

    test("en STDIO, por defecto, el cliente ve todas las que escriben", async () => {
        const writes = writeNames(await listTools(LOCAL));
        assert.ok(writes.length >= 7, `Hay ${writes.length}`);
        assert.ok(writes.includes("aula_forum_post"));
    });

    test("en HTTP, por defecto, ninguna; las de lectura siguen", async () => {
        const tools = await listTools(HTTP);
        assert.deepEqual(writeNames(tools), []);
        assert.ok(tools.some((t) => t.name === "aula_open"));
        // Sin aula_assign_submit, el link de subida no sirve.
        assert.ok(!tools.some((t) => t.name === "aula_assign_upload_link"));
    });

    test("con una lista, solo esas", async () => {
        const tools = await listTools(HTTP, new Set(["aula_forum_post", "aula_assign_submit"]));
        assert.deepEqual(writeNames(tools), ["aula_assign_submit", "aula_forum_post"]);
        assert.ok(tools.some((t) => t.name === "aula_assign_upload_link"));
    });
});
