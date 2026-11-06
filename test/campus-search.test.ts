/**
 * El registro de campus y cómo `unimcp login` encuentra el tuyo: con decenas de facultades, la lista
 * entera ya no entra en una pantalla, así que se busca por sigla, nombre o provincia.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { listCampuses, searchCampuses } from "../src/shared/campus.js";
import { campusList } from "../src/login.js";

const ids = (query: string) => searchCampuses(query).map((c) => c.id);

describe("registro de campus", () => {
    test("cada campus tiene id único, provincia y URLs https sin barra final", () => {
        const all = listCampuses();
        assert.equal(new Set(all.map((c) => c.id)).size, all.length);
        for (const c of all) {
            assert.ok(c.provincia, `${c.id} sin provincia`);
            for (const url of [c.aula?.baseUrl, c.guarani?.baseUrl].filter(Boolean) as string[]) {
                assert.match(url, /^https:\/\/[^/]+(\/[^/]+)*[^/]$/, `${c.id}: ${url}`);
            }
        }
    });
});

describe("buscar el campus", () => {
    test("por provincia, sin importar tildes ni mayúsculas", () => {
        assert.deepEqual(ids("cordoba").sort(), ["unc-famaf", "utn-frc"]);
        assert.deepEqual(ids("CÓRDOBA"), ids("cordoba"));
    });

    test("por sigla y palabra del nombre, todas a la vez", () => {
        assert.deepEqual(ids("uba filo"), ["uba-filo"]);
        assert.ok(ids("tucuman").includes("utn-frt"));
        assert.ok(ids("exactas").length > 2);
    });

    test("sin palabras, todos; con una que no está, ninguno", () => {
        assert.equal(searchCampuses("  ").length, listCampuses().length);
        assert.deepEqual(ids("zzz"), []);
    });

    test("la lista numera en orden y pone el nombre de cada provincia una vez", () => {
        const found = searchCampuses("tucuman").sort((a, b) => (a.provincia ?? "").localeCompare(b.provincia ?? "", "es"));
        const text = campusList(found);
        assert.equal(text.split("\n").filter((l) => l === "Tucumán").length, 1);
        assert.match(text, /^ {2} 1\. UNT · /m);
        assert.match(text, new RegExp(`^ {2}${String(found.length).padStart(2)}\. `, "m"));
    });
});
