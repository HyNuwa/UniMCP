/**
 * Notas del aula (aula_list_grades), con respuestas inventadas del libro de calificaciones de Moodle.
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { grades } from "../src/aula-virtual/format/grades.js";

const session: AulaSession = {
    site: { baseUrl: "https://aula.test" },
    getToken: async () => "tok",
    refreshToken: async () => "tok",
};

const COURSES = [
    { id: 10, shortname: "FIS", fullname: "Física  II", visible: 1 },
    { id: 20, shortname: "ALG", fullname: "Álgebra", visible: 1 },
];

/** Martes 20/10/2026 a las 12 h en Argentina. */
const GRADED = new Date("2026-10-20T15:00:00Z").getTime() / 1000;

const item = (extra: object) => ({
    id: 1,
    itemname: "TP 1",
    itemtype: "mod",
    itemmodule: "assign",
    gradeformatted: "-",
    rangeformatted: "0&ndash;10",
    percentageformatted: "-",
    feedback: "",
    gradeishidden: false,
    gradedategraded: null,
    ...extra,
});

const ITEMS: Record<number, object[]> = {
    10: [
        item({ cmid: 101, gradeformatted: "8,00", percentageformatted: "80,00 %", gradedategraded: GRADED,
            feedback: "<p>Muy bien. Revisá el <a href=\"https://aula.test/mod/page/view.php?id=5\">apunte</a></p>" }),
        item({ itemname: "Cuestionario 1", itemmodule: "quiz", cmid: 102 }),
        item({ itemname: "Parcial 1", itemtype: "manual", itemmodule: null, gradeformatted: "6,50",
            percentageformatted: "65,00 %", gradedategraded: GRADED - 86_400 }),
        item({ itemname: "TP 2", cmid: 103, gradeformatted: "9,00", gradeishidden: true }),
        item({ itemname: null, itemtype: "category", itemmodule: null }),
        item({ itemname: null, itemtype: "course", itemmodule: null, rangeformatted: "0&ndash;100" }),
    ],
};

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

function mockMoodle() {
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        switch (params.get("wsfunction")) {
            case "core_webservice_get_site_info":
                return Response.json({ userid: 7, username: "ana" });
            case "core_enrol_get_users_courses":
                return Response.json(COURSES);
            case "gradereport_user_get_grade_items": {
                const items = ITEMS[Number(params.get("courseid"))];
                // El docente ocultó el libro de calificaciones.
                if (!items) {
                    return Response.json({
                        exception: "moodle_exception",
                        errorcode: "nopermissiontoviewgrades",
                        message: "No se pueden ver las calificaciones.",
                    });
                }
                return Response.json({ usergrades: [{ courseid: 10, userid: 7, gradeitems: items }] });
            }
        }
        throw new Error(`Función sin mock: ${params.get("wsfunction")}`);
    }) as typeof fetch;
}

describe("aula_list_grades", () => {
    test("sin curso: un resumen de cada curso, y los que ocultan las notas lo dicen", async () => {
        mockMoodle();
        assert.deepEqual(await grades(session), {
            ultimaNota: { curso: "Física II", nombre: "TP 1", nota: "8,00", fecha: "2026-10-20T12:00:00-03:00" },
            cursos: [
                {
                    curso: "Física II",
                    direccion: "/curso/10",
                    total: undefined,
                    conNota: 2,
                    items: 4,
                    ultimaNota: { nombre: "TP 1", nota: "8,00", fecha: "2026-10-20T12:00:00-03:00" },
                },
                { curso: "Álgebra", direccion: "/curso/20", notasOcultas: true },
            ],
        });
    });

    test("con curso: cada ítem con nota, rango, devolución y dirección", async () => {
        mockMoodle();
        const r = await grades(session, { course: "/curso/10" });
        assert.ok(!("notasOcultas" in r));
        assert.deepEqual(r.total, { nota: undefined, rango: "0–100", porcentaje: undefined });
        assert.deepEqual(
            r.items.map((i) => [i.nombre, i.tipo, i.nota, i.porcentaje, i.oculta, i.direccion]),
            [
                ["TP 1", "assign", "8,00", "80,00 %", undefined, "/curso/10/mod/101"],
                ["Cuestionario 1", "quiz", undefined, undefined, undefined, "/curso/10/mod/102"],
                ["Parcial 1", "manual", "6,50", "65,00 %", undefined, undefined],
                // Oculta: Moodle manda la nota, pero el alumno no la ve en el aula.
                ["TP 2", "assign", undefined, undefined, true, "/curso/10/mod/103"],
                ["Categoría", "categoria", undefined, undefined, undefined, undefined],
            ],
        );
        assert.equal(r.items[0].rango, "0–10");
        assert.equal(r.items[0].fecha, "2026-10-20T12:00:00-03:00");
        assert.equal(r.items[0].devolucion, "Muy bien. Revisá el apunte (https://aula.test/mod/page/view.php?id=5)");
        assert.equal(r.items[1].fecha, undefined);
        assert.equal(r.recortado, undefined);
    });

    test("con curso: notas ocultas, curso ajeno y dirección que no es de un curso", async () => {
        mockMoodle();
        const hidden = await grades(session, { course: "/curso/20" });
        assert.equal(hidden.notasOcultas, true);
        assert.match(hidden.aviso!, /no muestra las notas/);
        await assert.rejects(grades(session, { course: "/curso/99" }), /No estás inscripto/);
        await assert.rejects(grades(session, { course: "/curso/10/mod/101" }), /dirección de un curso/);
    });

    test("una devolución larga se recorta y lo avisa", async () => {
        mockMoodle();
        ITEMS[30] = [item({ cmid: 301, gradeformatted: "7,00", feedback: `<p>${"palabra ".repeat(400)}</p>` })];
        COURSES.push({ id: 30, shortname: "QUI", fullname: "Química", visible: 1 });
        try {
            const r = await grades(session, { course: "/curso/30" });
            assert.ok(!("notasOcultas" in r));
            assert.ok(r.items[0].devolucion!.length <= 1_501);
            assert.equal(r.recortado, true);
            assert.match(r.aviso!, /recortada/);
        } finally {
            COURSES.pop();
            delete ITEMS[30];
        }
    });
});
