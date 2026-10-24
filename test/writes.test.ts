/**
 * Escrituras que Moodle no hizo: varias funciones no fallan, contestan `status: false` o con `warnings`.
 * Ninguna tool puede informar éxito en ese caso.
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
    createUserEvent,
    deleteChoicegroupResponses,
    deleteChoiceResponses,
    deletePost,
    submitChoicegroupResponse,
    submitChoiceResponse,
    updateDiscussionPost,
} from "../src/aula-virtual/client/moodle.js";
import type { AulaSession } from "../src/aula-virtual/client/session.js";

const session: AulaSession = {
    site: { baseUrl: "https://aula.test" },
    getToken: async () => "tok",
    refreshToken: async () => "tok",
};

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

/** Contesta `response` a la escritura y lo de siempre a site_info. */
function mockMoodle(response: unknown) {
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        if (params.get("wsfunction") === "core_webservice_get_site_info") return Response.json({ userid: 7 });
        return Response.json(response);
    }) as typeof fetch;
}

const WRITES: [string, () => Promise<unknown>][] = [
    ["editar una publicación", () => updateDiscussionPost(session, 1, "", "<p>x</p>")],
    ["borrar una publicación", () => deletePost(session, 1)],
    ["responder una elección", () => submitChoiceResponse(session, 1, [2])],
    ["borrar la respuesta de una elección", () => deleteChoiceResponses(session, 1)],
    ["elegir grupo", () => submitChoicegroupResponse(session, 1, [2])],
    ["borrar la elección de grupo", () => deleteChoicegroupResponses(session, 1)],
];

describe("escrituras que Moodle no hizo", () => {
    for (const [name, write] of WRITES) {
        test(name, async () => {
            mockMoodle({ status: false, warnings: [] });
            await assert.rejects(write(), /Moodle no/);
            mockMoodle({ status: true, warnings: [{ item: "x", warningcode: "x", message: "La actividad está cerrada." }] });
            await assert.rejects(write(), /La actividad está cerrada/);
            mockMoodle({ status: true, warnings: [] });
            await write();
        });
    }

    test("crear un evento dice por qué no se creó", async () => {
        mockMoodle({ events: [], warnings: [{ item: "x", warningcode: "x", message: "Fecha inválida." }] });
        await assert.rejects(
            createUserEvent(session, { name: "x", description: "", timestart: 1, timeduration: 0 }),
            /Fecha inválida/,
        );
    });
});
