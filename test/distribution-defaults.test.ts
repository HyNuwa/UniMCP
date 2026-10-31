/**
 * Los valores por defecto de privacidad y de escritura son los del código en todos los canales: el
 * registro de MCP, la extensión de Claude Desktop, la imagen de Docker y la plantilla `.env`. Un canal que
 * prenda `UNI_SHOW_THIRD_PARTY_DATA` o `UNIMCP_WRITE_TOOLS` abre los datos de otros o las escrituras a
 * quien instale por ahí, sin que nadie lo note.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const GUARDED = ["UNI_SHOW_THIRD_PARTY_DATA", "UNIMCP_WRITE_TOOLS"];

test("server.json declara las variables, si lo hace, sin valor", () => {
    const server = JSON.parse(read("server.json"));
    const declared = server.packages.flatMap((p: { environmentVariables?: Record<string, unknown>[] }) => p.environmentVariables ?? []);
    const withValue = declared.filter(
        (v: { name: string; default?: unknown; value?: unknown }) =>
            GUARDED.includes(v.name) && (v.default !== undefined || v.value !== undefined),
    );
    assert.deepEqual(withValue, []);
});

test("la extensión de Claude Desktop no las pasa", () => {
    const manifest = JSON.parse(read("mcpb/manifest.json"));
    const env = Object.keys(manifest.server.mcp_config.env ?? {});
    assert.deepEqual(env.filter((name) => GUARDED.includes(name)), []);
});

test("ni el Dockerfile ni .env.example las prenden", () => {
    for (const file of ["Dockerfile", ".env.example"]) {
        const active = read(file)
            .split(/\r?\n/)
            .filter((line) => !line.trimStart().startsWith("#"))
            .filter((line) => GUARDED.some((name) => line.includes(name)));
        assert.deepEqual(active, [], file);
    }
});
