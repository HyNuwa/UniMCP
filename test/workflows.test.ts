/**
 * Los workflows de GitHub Actions declaran sus permisos: sin `permissions`, heredan los del repo, que
 * pueden incluir escribir.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const dir = new URL("../.github/workflows/", import.meta.url);

test("cada workflow declara permissions", () => {
    const missing = readdirSync(dir)
        .filter((name) => /\.ya?ml$/.test(name))
        .filter((name) => !/^permissions:/m.test(readFileSync(new URL(name, dir), "utf8")));
    assert.deepEqual(missing, []);
});
