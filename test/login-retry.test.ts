/**
 * `unimcp login` con la contraseña mal: la vuelve a pedir en vez de cortar, hasta un límite para no
 * bloquear la cuenta, y un error que no es de contraseña (la red) corta enseguida.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { InvalidCredentialsError } from "../src/aula-virtual/client/token-login.js";
import { InvalidGuaraniCredentialsError } from "../src/guarani/client/g3w.js";
import type { Credentials } from "../src/shared/credentials.js";
import { askCredentials, MAX_LOGIN_ATTEMPTS } from "../src/shared/login-retry.js";

/** Contesta las preguntas en orden: usuario, contraseña, usuario, contraseña… */
function fakeIo(answers: string[]) {
    const asked: string[] = [];
    const next = async (question: string) => {
        asked.push(question);
        const answer = answers.shift();
        if (answer === undefined) throw new Error(`Pregunta de más: ${question}`);
        return answer;
    };
    return { asked, io: { ask: next, askHidden: next } };
}

const rejectWrong = (good: string, reject: () => Error) => {
    const tried: Credentials[] = [];
    const login = async (c: Credentials) => {
        tried.push(c);
        if (c.password !== good) throw reject();
        return "token";
    };
    return { tried, login };
};

describe("login con reintentos", () => {
    test("una contraseña mal la vuelve a pedir y sigue con la buena", async () => {
        const { asked, io } = fakeIo(["alumno", "mala", "alumno", "buena"]);
        const { tried, login } = rejectWrong("buena", () => new InvalidCredentialsError("Datos erróneos"));
        const result = await askCredentials("Usuario del aula: ", login, io);
        assert.deepEqual(result, { credentials: { username: "alumno", password: "buena" }, result: "token" });
        assert.equal(tried.length, 2);
        assert.equal(asked.length, 4);
    });

    test("también con Guaraní", async () => {
        const { io } = fakeIo(["123", "mala", "123", "buena"]);
        const { tried, login } = rejectWrong("buena", () => new InvalidGuaraniCredentialsError());
        await askCredentials("Usuario de Guaraní: ", login, io);
        assert.equal(tried.length, 2);
    });

    test(`después de ${MAX_LOGIN_ATTEMPTS} rechazos corta con el error de la plataforma`, async () => {
        const answers = Array.from({ length: MAX_LOGIN_ATTEMPTS }, () => ["alumno", "mala"]).flat();
        const { io } = fakeIo(answers);
        const { tried, login } = rejectWrong("buena", () => new InvalidCredentialsError());
        await assert.rejects(askCredentials("Usuario: ", login, io), InvalidCredentialsError);
        assert.equal(tried.length, MAX_LOGIN_ATTEMPTS);
    });

    test("un error que no es de contraseña corta en el primer intento", async () => {
        const { io } = fakeIo(["alumno", "buena"]);
        let calls = 0;
        const login = async () => {
            calls++;
            throw new TypeError("fetch failed");
        };
        await assert.rejects(askCredentials("Usuario: ", login, io), TypeError);
        assert.equal(calls, 1);
    });

    test("sin usuario corta sin probar", async () => {
        const { io } = fakeIo(["", "x"]);
        let calls = 0;
        await assert.rejects(
            askCredentials("Usuario: ", async () => calls++, io),
            /Falta el usuario/,
        );
        assert.equal(calls, 0);
    });
});
