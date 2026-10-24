/**
 * Mensajes recibidos (aula_list_messages), con respuestas inventadas de la mensajería de Moodle.
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { messages } from "../src/aula-virtual/format/messages.js";

const session: AulaSession = {
    site: { baseUrl: "https://aula.test" },
    getToken: async () => "tok",
    refreshToken: async () => "tok",
};
const ME = 7;
const PROF = { id: 50, fullname: "Prof.  Pérez" };
const T = new Date("2026-10-20T15:00:00Z").getTime() / 1000;

const message = (id: number, from: number, text: string, minutes = 0) => ({
    id,
    useridfrom: from,
    text,
    timecreated: T + minutes * 60,
});

const CONVERSATIONS = [
    { id: 1, name: "", type: 1, isread: false, unreadcount: 2, members: [PROF], messages: [message(11, 50, "<p>Sí, mañana hay consulta.</p>")] },
    { id: 2, name: "Grupo TP 3", type: 2, isread: true, unreadcount: null, members: [PROF, { id: 60, fullname: "Ana" }], messages: [message(21, ME, "Listo")] },
    { id: 3, name: "", type: 3, isread: true, unreadcount: 0, members: [], messages: [] },
];

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

function mockMoodle(threadOf: (from: number) => object[]) {
    const calls: URLSearchParams[] = [];
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        calls.push(params);
        switch (params.get("wsfunction")) {
            case "core_webservice_get_site_info":
                return Response.json({ userid: ME, username: "ana" });
            case "core_message_get_conversations":
                return Response.json({ conversations: CONVERSATIONS });
            case "core_message_get_unread_conversations_count":
                return Response.json(1);
            case "core_message_get_conversation_messages":
                if (params.get("convid") !== "1") {
                    return Response.json({ exception: "moodle_exception", errorcode: "nopermissions", message: "x" });
                }
                return Response.json({ id: 1, members: [PROF], messages: threadOf(Number(params.get("limitfrom"))) });
        }
        throw new Error(`Función sin mock: ${params.get("wsfunction")}`);
    }) as typeof fetch;
    return calls;
}

describe("aula_list_messages", () => {
    test("las conversaciones, con quién, sin leer y el último mensaje", async () => {
        mockMoodle(() => []);
        assert.deepEqual(await messages(session), {
            conversacionesSinLeer: 1,
            conversaciones: [
                {
                    conversacion: 1,
                    con: "Prof. Pérez",
                    tipo: undefined,
                    usuarioId: 50,
                    sinLeer: 2,
                    ultimo: { de: "Prof. Pérez", texto: "Sí, mañana hay consulta.", fecha: "2026-10-20T12:00:00-03:00" },
                },
                {
                    conversacion: 2,
                    con: "Grupo TP 3",
                    tipo: "grupo",
                    usuarioId: undefined,
                    sinLeer: undefined,
                    ultimo: { de: "vos", texto: "Listo", fecha: "2026-10-20T12:00:00-03:00" },
                },
                { conversacion: 3, con: "vos", tipo: "personal", usuarioId: undefined, sinLeer: undefined, ultimo: undefined },
            ],
            hayMasConversaciones: undefined,
        });
    });

    test("una conversación del más viejo al más nuevo, y la página siguiente si hay más", async () => {
        // Moodle manda primero el más nuevo.
        const calls = mockMoodle((from) =>
            from === 0
                ? Array.from({ length: 20 }, (_, i) => message(100 - i, i % 2 ? ME : 50, `<p>Mensaje ${20 - i}</p>`, -i))
                : [message(1, 50, "<p>Hola</p>", -100)],
        );
        const first = await messages(session, { conversation: 1 });
        assert.equal(first.mensajes[0].texto, "Mensaje 1");
        assert.equal(first.mensajes.at(-1)!.texto, "Mensaje 20");
        assert.deepEqual([...new Set(first.mensajes.map((m) => m.de))].sort(), ["Prof. Pérez", "vos"]);
        assert.equal(first.hayMasViejos, true);
        assert.match(first.aviso!, /pagina: 1/);

        const second = await messages(session, { conversation: 1, page: 1 });
        assert.deepEqual(second.mensajes.map((m) => m.texto), ["Hola"]);
        assert.equal(second.hayMasViejos, undefined);
        const asked = calls.filter((c) => c.get("wsfunction") === "core_message_get_conversation_messages");
        assert.deepEqual(asked.map((c) => [c.get("limitfrom"), c.get("newest")]), [["0", "1"], ["20", "1"]]);
    });

    test("una conversación ajena dice de dónde salen los ids", async () => {
        mockMoodle(() => []);
        await assert.rejects(messages(session, { conversation: 99 }), /No encontré la conversación 99/);
    });

    test("no marca nada como leído", async () => {
        const calls = mockMoodle(() => [message(1, 50, "Hola")]);
        await messages(session);
        await messages(session, { conversation: 1 });
        assert.ok(!calls.some((c) => /mark/.test(c.get("wsfunction") ?? "")));
    });
});
