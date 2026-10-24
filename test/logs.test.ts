/**
 * Los logs del modo hosteado los lee quien opera el servidor: no llevan el usuario del aula (puede ser el
 * DNI) ni el email.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { masked } from "../src/shared/logger.js";

/** Los `.ts` de `src/`, con su ruta. */
function sources(dir = fileURLToPath(new URL("../src", import.meta.url))): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? sources(path) : entry.name.endsWith(".ts") ? [path] : [];
    });
}

describe("logs", () => {
    test("masked deja solo el principio, y el dominio del email", () => {
        assert.equal(masked("40123456"), "40…");
        assert.equal(masked("ana.perez@fi.unju.edu.ar"), "an…@fi.unju.edu.ar");
        assert.equal(masked("ab"), "…");
        assert.equal(masked(""), "…");
    });

    test("ningún log muestra un usuario o un email sin enmascarar", () => {
        const leaks = sources().flatMap((file) =>
            readFileSync(file, "utf8")
                .split("\n")
                .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
                .filter(({ line }) => /logger\.\w+\(.*\$\{(?!masked\()[^}]*\b(username|email|usuario)\b/.test(line))
                .map(({ at }) => at),
        );
        assert.deepEqual(leaks, []);
    });
});
