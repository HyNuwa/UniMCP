/**
 * Cómo le pedimos las cosas al aula: sin pedidos repetidos, sin saturarla y sin escrituras dobles.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, test } from "node:test";
import { deletePost, getSiteInfo, getUnusedDraftItemId, getUserCourses } from "../src/aula-virtual/client/moodle.js";
import { callWs } from "../src/aula-virtual/client/web-service.js";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { fetchWithCookies } from "../src/shared/http.js";
import { CookieJar } from "tough-cookie";

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

describe("User-Agent", () => {
    test("el aula y Guaraní saben quién les pide", async () => {
        const agents: (string | null)[] = [];
        globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
            agents.push(new Headers(init?.headers).get("user-agent"));
            return Response.json({ userid: 7 });
        }) as typeof fetch;
        await getSiteInfo(sessionWith(() => "tok-ua"));
        await fetchWithCookies(new CookieJar(), "https://guarani.test/acceso");
        const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
        assert.deepEqual(agents, Array(2).fill(`unimcp/${version} (+https://github.com/HyNuwa/UniMCP)`));
    });
});

describe("cuidar el aula", () => {
    test("nunca más de 6 pedidos a la vez por sesión", async () => {
        let inFlight = 0;
        let most = 0;
        globalThis.fetch = (async () => {
            most = Math.max(most, ++inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight--;
            return Response.json([]);
        }) as typeof fetch;
        const session = sessionWith(() => "tok");
        const calls = Array.from({ length: 30 }, () => callWs(session, "core_course_get_updates_since"));
        const results = await Promise.all(calls);
        assert.equal(results.length, 30);
        assert.equal(most, 6);
    });

    /** Contesta los `statuses` en orden y después 200; devuelve cuántos pedidos llegaron. */
    function mockStatuses(...statuses: number[]) {
        let calls = 0;
        globalThis.fetch = (async () => {
            const status = statuses[calls++];
            if (!status) return Response.json({ userid: 7, status: true, warnings: [] });
            return new Response("", { status, headers: { "retry-after": "0" } });
        }) as typeof fetch;
        return () => calls;
    }

    test("ante 429 espera y reintenta, también una escritura: no se hizo", async () => {
        const calls = mockStatuses(429, 429);
        await deletePost(sessionWith(() => "tok"), 1);
        assert.equal(calls(), 3);
    });

    test("ante 503 reintenta una lectura, nunca una escritura", async () => {
        let calls = mockStatuses(503);
        assert.equal((await getSiteInfo(sessionWith(() => "tok-503"))).userid, 7);
        assert.equal(calls(), 2);

        calls = mockStatuses(503);
        await assert.rejects(deletePost(sessionWith(() => "tok"), 1), /saturado/);
        assert.equal(calls(), 1);
    });

    test("si sigue saturado, o pide esperar demasiado, lo dice", async () => {
        const calls = mockStatuses(429, 429, 429);
        await assert.rejects(getUserCourses(sessionWith(() => "tok-429")), /aula.test está saturado \(HTTP 429\)/);
        assert.equal(calls(), 3);

        let asked = 0;
        globalThis.fetch = (async () => {
            asked++;
            return new Response("", { status: 429, headers: { "retry-after": "3600" } });
        }) as typeof fetch;
        await assert.rejects(getUserCourses(sessionWith(() => "tok-espera")), /saturado/);
        assert.equal(asked, 1);
    });
});

describe("aulas con Moodle viejo", () => {
    test("sin core_files_get_unused_draft_itemid (Moodle < 3.11) el borrador sale al azar", async () => {
        const calls = mockMoodle((f) =>
            f === "core_webservice_get_site_info" ? { userid: 7, functions: [{ name: "mod_assign_save_submission" }] } : {},
        );
        const id = await getUnusedDraftItemId(sessionWith(() => "tok-viejo"));
        assert.ok(Number.isInteger(id) && id >= 1 && id < 1_000_000_000);
        assert.ok(!calls.includes("core_files_get_unused_draft_itemid"));
    });

    test("con la función, la usa", async () => {
        mockMoodle((f) =>
            f === "core_webservice_get_site_info"
                ? { userid: 7, functions: [{ name: "core_files_get_unused_draft_itemid" }] }
                : { itemid: 4242 },
        );
        assert.equal(await getUnusedDraftItemId(sessionWith(() => "tok-nuevo")), 4242);
    });
});
