/**
 * Cómo le pedimos las cosas al aula: sin pedidos repetidos, sin saturarla y sin escrituras dobles.
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { getSiteInfo, getUserCourses } from "../src/aula-virtual/client/moodle.js";
import type { AulaSession } from "../src/aula-virtual/client/session.js";

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

const sessionWith = (token: () => string): AulaSession => ({
    site: { baseUrl: "https://aula.test" },
    getToken: async () => token(),
    refreshToken: async () => token(),
});

/** Cuenta los pedidos por función y contesta `respond`. */
function mockMoodle(respond: (wsfunction: string, params: URLSearchParams) => unknown) {
    const calls: string[] = [];
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        const wsfunction = params.get("wsfunction")!;
        calls.push(wsfunction);
        return Response.json(respond(wsfunction, params));
    }) as typeof fetch;
    return calls;
}

const siteInfoOf = (params: URLSearchParams) => ({ userid: params.get("wstoken") === "tok-ana" ? 7 : 8 });

describe("site_info", () => {
    test("se pide una vez por sesión, aunque lo necesiten varias llamadas a la vez", async () => {
        const calls = mockMoodle((f, p) => (f === "core_webservice_get_site_info" ? siteInfoOf(p) : []));
        const session = sessionWith(() => "tok-ana");
        await Promise.all([getUserCourses(session), getUserCourses(session), getSiteInfo(session)]);
        await getUserCourses(session);
        assert.equal(calls.filter((f) => f === "core_webservice_get_site_info").length, 1);
    });

    test("con otro token se vuelve a pedir: puede ser otro usuario", async () => {
        mockMoodle((f, p) => (f === "core_webservice_get_site_info" ? siteInfoOf(p) : []));
        let token = "tok-ana";
        const session = sessionWith(() => token);
        assert.equal((await getSiteInfo(session)).userid, 7);
        token = "tok-otro";
        assert.equal((await getSiteInfo(session)).userid, 8);
    });

    test("un error no queda guardado", async () => {
        let fail = true;
        mockMoodle(() =>
            fail ? { exception: "moodle_exception", errorcode: "x", message: "Caído" } : { userid: 7 },
        );
        const session = sessionWith(() => "tok-ana");
        await assert.rejects(getSiteInfo(session), /Caído/);
        fail = false;
        assert.equal((await getSiteInfo(session)).userid, 7);
    });
});
