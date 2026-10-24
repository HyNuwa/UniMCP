/**
 * El server.json del registro de MCP coincide con package.json: el registro rechaza un paquete de npm cuyo
 * `mcpName` no sea el nombre del servidor, y una versión vieja publicaría la que ya estaba.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file: string) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));

test("server.json y package.json coinciden en nombre y versión", () => {
    const pkg = read("package.json");
    const server = read("server.json");
    assert.equal(server.name, pkg.mcpName);
    assert.equal(server.version, pkg.version);
    assert.deepEqual(
        server.packages.map((p: { identifier: string; version: string }) => [p.identifier, p.version]),
        [[pkg.name, pkg.version]],
    );
});

test("la descripción entra en los 100 caracteres del registro", () => {
    assert.ok(read("server.json").description.length <= 100);
});
