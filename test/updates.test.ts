/**
 * Novedades del aula (aula_list_updates), con respuestas inventadas de `core_course_get_updates_since`.
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { updates } from "../src/aula-virtual/format/updates.js";

const session: AulaSession = {
    site: { baseUrl: "https://aula.test" },
    getToken: async () => "tok",
    refreshToken: async () => "tok",
};
/** Martes 20/10/2026 a las 12 h en Argentina. */
const NOW = new Date("2026-10-20T15:00:00Z");
const T = NOW.getTime() / 1000;
const DAY = 86_400;

const COURSES = [
    { id: 10, shortname: "FIS", fullname: "Física  II", visible: 1 },
    { id: 20, shortname: "ALG", fullname: "Álgebra", visible: 1 },
    { id: 30, shortname: "QUI", fullname: "Química", visible: 1 },
];

const MODULES: Record<number, { name: string; modname: string }> = {
    101: { name: "Guía  de TP 3", modname: "resource" },
    102: { name: "Avisos", modname: "forum" },
    201: { name: "Cuestionario 1", modname: "quiz" },
};

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

function mockMoodle(updatesOf: (courseid: number) => object[]) {
    const calls: { fn: string; params: URLSearchParams }[] = [];
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        const fn = params.get("wsfunction")!;
        calls.push({ fn, params });
        switch (fn) {
            case "core_webservice_get_site_info":
                return Response.json({ userid: 7, username: "ana" });
            case "core_enrol_get_users_courses":
                return Response.json(COURSES);
            case "core_course_get_updates_since":
                return Response.json({ instances: updatesOf(Number(params.get("courseid"))), warnings: [] });
            case "core_course_get_course_module": {
                const cmid = Number(params.get("cmid"));
                const m = MODULES[cmid];
                // Un módulo que el alumno no puede ver.
                if (!m) return Response.json({ exception: "require_login_exception", errorcode: "requireloginerror" });
                return Response.json({ cm: { id: cmid, course: Math.floor(cmid / 10), ...m } });
            }
        }
        throw new Error(`Función sin mock: ${fn}`);
    }) as typeof fetch;
    return calls;
}

const module = (id: number, ...updates: object[]) => ({ contextlevel: "module", id, updates });

describe("aula_list_updates", () => {
    test("los módulos que cambiaron, con nombre, cambios en castellano y dirección", async () => {
        const calls = mockMoodle((courseid) =>
            courseid === 10
                ? [
                      module(101, { name: "configuration", timeupdated: T - DAY }, { name: "contentfiles", itemids: [1, 2] }),
                      module(102, { name: "discussions", itemids: [5, 6, 7] }),
                      module(109, { name: "configuration", timeupdated: T }),
                  ]
                : courseid === 20
                  ? [module(201, { name: "grades", itemids: [3] }, { name: "cosanueva" })]
                  : [],
        );

        const r = await updates(session, {}, NOW);

        assert.equal(r.desde, "2026-10-13T12:00:00-03:00");
        assert.deepEqual(r.cursos, [
            {
                curso: "Física II",
                direccion: "/curso/10",
                novedades: [
                    {
                        nombre: "Guía de TP 3",
                        tipo: "resource",
                        cambios: ["editada", "archivos (2)"],
                        direccion: "/curso/10/mod/101",
                    },
                    {
                        nombre: "Avisos",
                        tipo: "forum",
                        cambios: ["discusiones con novedades (3)"],
                        direccion: "/curso/10/mod/102",
                    },
                    // El 109 no se puede abrir: no aparece.
                ],
                otrasNovedades: undefined,
            },
            {
                curso: "Álgebra",
                direccion: "/curso/20",
                novedades: [
                    { nombre: "Cuestionario 1", tipo: "quiz", cambios: ["nota (1)", "cosanueva"], direccion: "/curso/20/mod/201" },
                ],
                otrasNovedades: undefined,
            },
        ]);
        assert.equal(r.sinNovedades, 1);
        assert.equal(r.recortado, undefined);
        const since = calls.find((c) => c.fn === "core_course_get_updates_since")!.params.get("since");
        assert.equal(Number(since), T - 7 * DAY);
    });

    test("filtra por curso, con los días pedidos", async () => {
        const calls = mockMoodle((courseid) => (courseid === 20 ? [module(201, { name: "attempts", itemids: [1] })] : []));
        const r = await updates(session, { course: "/curso/20", days: 1 }, NOW);
        assert.deepEqual(r.cursos.map((c) => c.curso), ["Álgebra"]);
        assert.equal(r.sinNovedades, undefined);
        const asked = calls.filter((c) => c.fn === "core_course_get_updates_since");
        assert.deepEqual(asked.map((c) => [c.params.get("courseid"), Number(c.params.get("since"))]), [["20", T - DAY]]);
        await assert.rejects(updates(session, { course: "/curso/99" }, NOW), /No estás inscripto/);
    });

    test("con más de 40 módulos muestra los primeros y avisa", async () => {
        const many = Array.from({ length: 30 }, (_, i) => module(1000 + i, { name: "configuration" }));
        for (let i = 0; i < 30; i++) MODULES[1000 + i] = { name: `Clase ${i}`, modname: "page" };
        try {
            mockMoodle((courseid) => (courseid === 30 ? [] : many));
            const r = await updates(session, {}, NOW);
            assert.deepEqual(r.cursos.map((c) => [c.novedades.length, c.otrasNovedades]), [[30, undefined], [10, 20]]);
            assert.equal(r.recortado, true);
            assert.match(r.aviso!, /Cambiaron 60 módulos y se muestran 40/);
        } finally {
            for (let i = 0; i < 30; i++) delete MODULES[1000 + i];
        }
    });
});
