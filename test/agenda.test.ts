/**
 * Lo que viene en el aula (aula_list_upcoming), con respuestas inventadas de la línea de tiempo y del
 * calendario de Moodle.
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { upcoming } from "../src/aula-virtual/format/agenda.js";

const AULA = "https://aula.test";
const session: AulaSession = {
    site: { baseUrl: AULA },
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
];

const action = (id: number, courseId: number, cmid: number, timesort: number, extra: object = {}) => ({
    id,
    name: `Actividad ${id}`,
    modulename: "assign",
    eventtype: "due",
    timesort,
    course: { id: courseId, fullname: COURSES.find((c) => c.id === courseId)!.fullname },
    action: { name: "Agregar entrega", actionable: true },
    url: `${AULA}/mod/assign/view.php?id=${cmid}`,
    ...extra,
});

const calendarEvent = (id: number, courseid: number, timestart: number, extra: object = {}) => ({
    id,
    name: `Evento ${id}`,
    description: "",
    courseid,
    modulename: "quiz",
    instance: 1,
    eventtype: "open",
    timestart,
    timeduration: 0,
    ...extra,
});

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

/** Contesta cada función del web service con `responses` y anota los parámetros de cada llamada. */
function mockMoodle(responses: Record<string, (params: URLSearchParams) => unknown>) {
    const calls: { fn: string; params: URLSearchParams }[] = [];
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        const fn = params.get("wsfunction")!;
        calls.push({ fn, params });
        const handler = responses[fn];
        if (!handler) throw new Error(`Función sin mock: ${fn}`);
        return Response.json(handler(params));
    }) as typeof fetch;
    return calls;
}

const base = {
    core_webservice_get_site_info: () => ({ userid: 7, username: "ana" }),
    core_enrol_get_users_courses: () => COURSES,
};

describe("aula_list_upcoming", () => {
    test("pendientes con su dirección, vencidos y no disponibles; el calendario sin repetirlos", async () => {
        const calls = mockMoodle({
            ...base,
            core_calendar_get_action_events_by_timesort: () => ({
                events: [
                    action(1, 10, 101, T - 2 * DAY),
                    action(2, 20, 202, T + 3 * DAY, {
                        modulename: "quiz",
                        eventtype: "close",
                        action: { name: "Intente resolver el cuestionario ahora", actionable: false },
                        url: `${AULA}/mod/quiz/view.php?id=202`,
                    }),
                ],
            }),
            core_calendar_get_calendar_events: () => ({
                events: [
                    // El mismo vencimiento que el pendiente 2: no se repite.
                    calendarEvent(2, 20, T + 3 * DAY),
                    calendarEvent(5, 20, T + 1 * DAY, { timeduration: 5400 }),
                    calendarEvent(6, 10, T + 2 * DAY, {
                        modulename: "",
                        eventtype: "course",
                        description: '<p>Parcial en el <a href="https://mapa.test/aula3">aula 3</a></p>',
                    }),
                    calendarEvent(7, 0, T + 4 * DAY, { modulename: "", eventtype: "user" }),
                    // Ya pasó: no es "lo que viene".
                    calendarEvent(8, 10, T - DAY),
                ],
                warnings: [],
            }),
        });

        const r = await upcoming(session, {}, NOW);

        assert.equal(r.desde, "2026-10-20T12:00:00-03:00");
        assert.equal(r.hasta, "2026-11-03T12:00:00-03:00");
        assert.deepEqual(r.pendientes, [
            {
                nombre: "Actividad 1",
                curso: "Física II",
                tipo: "assign",
                fecha: "2026-10-18T12:00:00-03:00",
                vencida: true,
                disponible: undefined,
                accion: "Agregar entrega",
                direccion: "/curso/10/mod/101",
            },
            {
                nombre: "Actividad 2",
                curso: "Álgebra",
                tipo: "quiz",
                fecha: "2026-10-23T12:00:00-03:00",
                vencida: undefined,
                disponible: false,
                accion: undefined,
                direccion: "/curso/20/mod/202",
            },
        ]);
        assert.deepEqual(
            r.eventos?.map((e) => [e.nombre, e.tipo, e.curso, e.direccion]),
            [
                ["Evento 5", "quiz", "Álgebra", "/curso/20"],
                ["Evento 6", "curso", "Física II", "/curso/10"],
                ["Evento 7", "personal", undefined, undefined],
            ],
        );
        assert.equal(r.eventos?.[0].duracionMinutos, 90);
        assert.equal(r.eventos?.[1].detalle, "Parcial en el aula 3 (https://mapa.test/aula3)");
        assert.equal(r.recortado, undefined);

        // Mira 14 días hacia atrás para los vencidos y pide el calendario de todos los cursos.
        const timeline = calls.find((c) => c.fn === "core_calendar_get_action_events_by_timesort")!.params;
        assert.equal(Number(timeline.get("timesortfrom")), T - 14 * DAY);
        const calendar = calls.find((c) => c.fn === "core_calendar_get_calendar_events")!.params;
        assert.deepEqual(calendar.getAll("events[courseids][0]").concat(calendar.getAll("events[courseids][1]")), ["10", "20"]);
    });

    test("filtra por curso y rechaza una dirección que no es de un curso", async () => {
        const calls = mockMoodle({
            ...base,
            core_calendar_get_action_events_by_timesort: () => ({
                events: [action(1, 10, 101, T + DAY), action(2, 20, 202, T + DAY)],
            }),
            core_calendar_get_calendar_events: () => ({ events: [], warnings: [] }),
        });

        const r = await upcoming(session, { course: "/curso/20", days: 7 }, NOW);
        assert.deepEqual(r.pendientes.map((p) => p.direccion), ["/curso/20/mod/202"]);
        assert.equal(r.eventos, undefined);
        const calendar = calls.find((c) => c.fn === "core_calendar_get_calendar_events")!.params;
        assert.equal(calendar.get("events[courseids][0]"), "20");
        assert.equal(calendar.get("events[courseids][1]"), null);

        await assert.rejects(upcoming(session, { course: "/curso/20/sec/1" }, NOW), /dirección de un curso/);
        await assert.rejects(upcoming(session, { course: "/curso/99" }, NOW), /No estás inscripto/);
    });

    test("junta la línea de tiempo de a 50 y avisa cuando no entra todo", async () => {
        const page = (from: number) => Array.from({ length: 50 }, (_, i) => action(from + i, 10, 100 + from + i, T + DAY));
        const after: (string | null)[] = [];
        mockMoodle({
            ...base,
            core_calendar_get_action_events_by_timesort: (p) => {
                after.push(p.get("aftereventid"));
                return { events: page(after.length * 50) };
            },
            core_calendar_get_calendar_events: () => ({ events: [], warnings: [] }),
        });

        const r = await upcoming(session, {}, NOW);
        assert.equal(r.pendientes.length, 200);
        // Cada página sigue desde el último id de la anterior.
        assert.deepEqual(after, [null, "99", "149", "199"]);
        assert.equal(r.recortado, true);
        assert.match(r.aviso!, /menos `dias`/);
    });
});
