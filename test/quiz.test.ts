/**
 * Un cuestionario se abre con su estado calculado contra la fecha de consulta, sus fechas y los intentos
 * que quedan. Nunca se piden preguntas ni respuestas.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import type { CourseModule } from "../src/aula-virtual/client/types.js";
import { viewQuiz } from "../src/aula-virtual/format/activities.js";

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

const session: AulaSession = {
    site: { baseUrl: "https://aula.test" },
    getToken: async () => "tok",
    refreshToken: async () => "tok",
};
const module = { id: 70, instance: 7, modname: "quiz", name: "Parcialito 1", uservisible: true } as CourseModule;

/** 10/10/2026 a las 0 h UTC, 9/10 a las 21 h en Argentina. */
const OPEN = 1_791_590_400;
const CLOSE = OPEN + 7 * 86_400;

/** Un aula con un cuestionario y los intentos dados; `attempts: null` simula un aula que no los muestra. */
function mockQuiz(quiz: Record<string, unknown>, attempts: unknown[] | null = []) {
    const called: string[] = [];
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        const fn = params.get("wsfunction") ?? "";
        called.push(fn);
        if (fn === "mod_quiz_get_quizzes_by_courses") {
            return Response.json({
                quizzes: [{ id: 7, coursemodule: 70, timeopen: OPEN, timeclose: CLOSE, timelimit: 1800, attempts: 2, grade: 10, sumgrades: 20, ...quiz }],
            });
        }
        if (fn === "mod_quiz_get_user_attempts") {
            return attempts ? Response.json({ attempts }) : Response.json({ exception: "x", errorcode: "nopermissions", message: "No" });
        }
        throw new Error(`pedido inesperado: ${fn}`);
    }) as typeof fetch;
    return called;
}

const at = (seconds: number) => new Date(seconds * 1000);

test("el estado sale de comparar las fechas con la de consulta", async () => {
    mockQuiz({});
    assert.equal((await viewQuiz(session, 3, module, at(OPEN - 60))).estado, "todavía no abre");
    assert.equal((await viewQuiz(session, 3, module, at(OPEN + 60))).estado, "abierto");
    assert.equal((await viewQuiz(session, 3, module, at(CLOSE + 60))).estado, "cerrado");
});

test("fechas en hora argentina, límite en minutos e intentos que quedan con la nota escalada", async () => {
    const called = mockQuiz({}, [{ attempt: 1, state: "finished", timestart: OPEN + 100, timefinish: OPEN + 900, sumgrades: 15 }]);
    const quiz = await viewQuiz(session, 3, module, at(OPEN + 1000));
    assert.equal(quiz.abre, "2026-10-09T21:00:00-03:00");
    assert.equal(quiz.limiteMinutos, 30);
    assert.equal(quiz.intentosPermitidos, 2);
    assert.equal(quiz.intentosQuedan, 1);
    assert.deepEqual(quiz.intentos?.[0], {
        numero: 1,
        estado: "terminado",
        empezado: "2026-10-09T21:01:40-03:00",
        terminado: "2026-10-09T21:15:00-03:00",
        nota: "7.5 / 10",
    });
    // Solo configuración e intentos: nada de preguntas, respuestas ni empezar un intento.
    assert.deepEqual([...new Set(called)].sort(), ["mod_quiz_get_quizzes_by_courses", "mod_quiz_get_user_attempts"]);
});

test("sin cierre lo dice, y sin límite de intentos no cuenta los que quedan", async () => {
    mockQuiz({ timeclose: 0, attempts: 0 });
    const quiz = await viewQuiz(session, 3, module, at(OPEN + 60));
    assert.equal(quiz.sinCierre, true);
    assert.equal(quiz.cierra, undefined);
    assert.equal(quiz.intentosPermitidos, "sin límite");
    assert.equal(quiz.intentosQuedan, undefined);
});

test("si el aula no muestra los intentos, igual trae las fechas", async () => {
    mockQuiz({}, null);
    const quiz = await viewQuiz(session, 3, module, at(OPEN + 60));
    assert.equal(quiz.estado, "abierto");
    assert.equal(quiz.intentos, undefined);
    assert.equal(quiz.intentosQuedan, undefined);
});

test("una nota que el docente todavía no muestra no aparece", async () => {
    mockQuiz({}, [{ attempt: 1, state: "finished", timestart: OPEN, timefinish: OPEN + 60, sumgrades: null }]);
    const quiz = await viewQuiz(session, 3, module, at(OPEN + 100));
    assert.equal(quiz.intentos?.[0].nota, undefined);
});
