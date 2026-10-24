/**
 * Escrituras que Moodle no hizo: varias funciones no fallan, contestan `status: false` o con `warnings`.
 * Ninguna tool puede informar éxito en ese caso. Y si la respuesta no llegó, no se sabe si se hizo.
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
    addDiscussion,
    addDiscussionPost,
    createUserEvent,
    deleteChoicegroupResponses,
    deleteChoiceResponses,
    deletePost,
    getUserCourses,
    removeSubmission,
    saveSubmission,
    sendInstantMessage,
    submitChoicegroupResponse,
    submitChoiceResponse,
    submitForGrading,
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

/** Todas las funciones que escriben en el aula. */
const ALL_WRITES: [string, () => Promise<unknown>][] = [
    ...WRITES,
    ["publicar una discusión", () => addDiscussion(session, 1, "x", "<p>x</p>")],
    ["responder en una discusión", () => addDiscussionPost(session, 1, "x", "<p>x</p>")],
    ["guardar una entrega", () => saveSubmission(session, 1, { filesItemId: 2 })],
    ["enviar una entrega", () => submitForGrading(session, 1, true)],
    ["borrar una entrega", () => removeSubmission(session, 1)],
    ["mandar un mensaje", () => sendInstantMessage(session, 1, "<p>x</p>")],
    ["crear un evento", () => createUserEvent(session, { name: "x", description: "", timestart: 1, timeduration: 0 })],
];

/** La escritura falla con `fail`; site_info contesta bien. */
function mockFailingWrite(fail: () => Response) {
    let writes = 0;
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        if (params.get("wsfunction") === "core_webservice_get_site_info") return Response.json({ userid: 7 });
        writes++;
        return fail();
    }) as typeof fetch;
    return () => writes;
}

const networkError = (code: string) => () => {
    throw new TypeError("fetch failed", { cause: { code } });
};

describe("escrituras sin respuesta", () => {
    for (const [name, write] of ALL_WRITES) {
        test(`${name}: si pudo haberse hecho, lo dice y no reintenta`, async () => {
            const timeout = () => {
                throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
            };
            for (const fail of [timeout, networkError("ECONNRESET"), () => new Response("", { status: 500 })]) {
                const writes = mockFailingWrite(fail);
                await assert.rejects(write(), { name: "UncertainWriteError", message: /revisá en el aula/ });
                assert.equal(writes(), 1);
            }
        });
    }

    test("si el pedido no salió, el error de siempre", async () => {
        mockFailingWrite(networkError("ECONNREFUSED"));
        await assert.rejects(deletePost(session, 1), { name: "HttpError", message: /No se pudo conectar/ });
    });

    test("una lectura no habla de cambios", async () => {
        mockFailingWrite(() => new Response("", { status: 500 }));
        await assert.rejects(getUserCourses(session), { name: "HttpError", message: /HTTP 500/ });
    });
});
