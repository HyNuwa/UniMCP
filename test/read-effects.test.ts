/**
 * Leer no deja rastro en el aula. Moodle tiene funciones de "lectura" con efectos: las `*_view_*`
 * registran que el usuario vio algo (el docente lo ve en los reportes y puede marcar la actividad como
 * completada), otras marcan mensajes como leídos o empiezan un intento de cuestionario. Ninguna tool las
 * usa, y lo que cambia algo se llama con `WRITE`.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const dir = new URL("../src/aula-virtual/client/", import.meta.url);
const source = readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(new URL(name, dir), "utf8"))
    .join("\n");

/** Las funciones del web service que llama el cliente. */
const FUNCTIONS = [...new Set(source.match(/(?<=")(?:core|mod|gradereport|tool|message|block|local)_[a-z0-9_]+(?=")/g))];

/** Lo que registra actividad del usuario aunque se llame para leer. */
const EFFECTS = /_view_|_view$|mark_.*read|_start_attempt|_process_attempt|_save_attempt|_launch|_log_|_trigger/;

/** Nombres que en Moodle son de lectura. */
const READ_NAME = /_get_|_can_|_count$/;

test("ninguna función registra que el usuario vio algo", () => {
    assert.ok(FUNCTIONS.length > 10, "no se encontraron las funciones del cliente");
    assert.deepEqual(FUNCTIONS.filter((f) => EFFECTS.test(f)), []);
});

test("lo que no tiene nombre de lectura se llama con WRITE", () => {
    const writes = new Set(
        [...source.matchAll(/"([a-z0-9_]+)"[^)]*?\bWRITE\b/g)].map((m) => m[1]).filter((f) => FUNCTIONS.includes(f)),
    );
    assert.deepEqual(FUNCTIONS.filter((f) => !READ_NAME.test(f) && !writes.has(f)), []);
});
