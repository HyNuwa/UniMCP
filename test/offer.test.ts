import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { CookieJar } from "tough-cookie";
import type { GuaraniSession } from "../src/guarani/client/session.js";
import { commissionOffer } from "../src/guarani/format/offer.js";
import { openPage } from "../src/guarani/format/page.js";
import { matchesSubject } from "../src/guarani/format/subjects.js";

/** Una comisión como la arma `oferta_comisiones` de G3W en UNJu, con los datos reemplazados. */
const commission = (name: string, extra = "", schedule = "<td> Sin definir </td><td>Sin definir</td><td> Sin definir </td><td> Aula a determinar </td>") =>
    '<table class="table table-bordered table-condensed comision" comision="1" sede="1" docentes="X"><tbody>' +
    `<tr class="comision"><th colspan="1"><h5>Comisión: ${name}</h5></th>` +
    '<td colspan="2" class="detalle_comision"><span><strong>Turno:</strong> Sin definir </span><span><strong>Cupo / insc.:</strong> Sin definir / 12 </span></td>' +
    '<td colspan="1" class="detalle_comision"><span><strong>Instancias:</strong> Regularidad/Promoción </span>' +
    "<span><strong>Ubicación:</strong> Sede Centro </span><span><strong>Docentes:</strong> DOCENTE UNO (Docente a cargo)</span></td></tr>" +
    extra +
    '<tr class="horarios encabezados"><th class="tipo_curso">Tipo de clase</th><th class="dia">Día</th><th class="horario">Horario</th><th class="aula">Aula</th></tr>' +
    `<tr class="js-dia horarios oscuro visible" dia_sem="x" comision="1">${schedule}</tr>` +
    "</tbody></table>";

const subject = (title: string, ...commissions: string[]) =>
    `<div class="js-recuadro_actividad" actividad="${title}"><h4>Actividad: ${title}</h4>${commissions.join("")}</div>`;

const period = (title: string, ...subjects: string[]) =>
    `<div class="js-recuadro_periodo recuadro" periodo="1"><h3>Período lectivo: ${title}</h3>${subjects.join("")}</div>`;

test("la oferta va por período, materia y comisión, sin lo que Guaraní no definió", () => {
    const html = period(
        "2026 - 2º cuatrimestre - FI",
        subject(
            "MATERIA UNO (AB101)",
            commission("AB101-COM1", '<tr class="comision"><td colspan="4" class="detalle_comision observaciones"><strong>Observaciones: </strong> Expediente 123 </td></tr>'),
            commission("AB101-COM2", "", "<td> Teórica </td><td>Lunes</td><td> 08:00 a 10:00 </td><td> Aula 5 </td>"),
        ),
    );
    assert.deepEqual(commissionOffer(html), {
        oferta: [
            {
                periodo: "2026 - 2º cuatrimestre - FI",
                materias: [
                    {
                        materia: "MATERIA UNO",
                        codigo: "AB101",
                        comisiones: [
                            {
                                comision: "AB101-COM1",
                                inscriptos: 12,
                                instancias: "Regularidad/Promoción",
                                ubicacion: "Sede Centro",
                                docentes: "DOCENTE UNO (Docente a cargo)",
                                observaciones: "Expediente 123",
                            },
                            {
                                comision: "AB101-COM2",
                                inscriptos: 12,
                                instancias: "Regularidad/Promoción",
                                ubicacion: "Sede Centro",
                                docentes: "DOCENTE UNO (Docente a cargo)",
                                horarios: ["Teórica | Lunes | 08:00 a 10:00 | Aula 5"],
                            },
                        ],
                    },
                ],
            },
        ],
        columnasHorarios: "Tipo de clase | Día | Horario | Aula",
    });
});

test("una página sin oferta no se estructura", () => {
    assert.equal(commissionOffer("<table><tr><td>Algo</td></tr></table>"), undefined);
});

test("materia: por código o por palabras del nombre, sin tildes", () => {
    const am2 = { materia: "ANÁLISIS MATEMÁTICO II", codigo: "IF159" };
    const am1 = { materia: "ANÁLISIS MATEMÁTICO I", codigo: "IF154" };
    assert.ok(matchesSubject("if159", am2));
    assert.ok(matchesSubject("analisis ii", am2));
    assert.ok(!matchesSubject("analisis ii", am1));
    assert.ok(matchesSubject("anal mat", am1));
    // Una palabra corta tiene que ser entera: "i" no es el comienzo de cualquier cosa.
    assert.ok(!matchesSubject("i", am2));
    assert.ok(matchesSubject(undefined, am1));
    assert.ok(matchesSubject("  ", am1));
});

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

/** Guaraní con una sola página, la oferta, servida como pagelet. */
function serveOffer(html: string): GuaraniSession {
    const pagelet = `<script>kernel.renderer.on_arrival(${JSON.stringify({ op: "oferta_comisiones", info: { id: "oferta_com" }, content: html })});</script>`;
    globalThis.fetch = (async () =>
        new Response(`<html><body>${pagelet}</body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } })) as typeof fetch;
    const jar = new CookieJar();
    return { site: { baseUrl: "https://g3w.test/autogestion" }, getJar: async () => jar, renew: async () => jar, save: async () => {} };
}

test("una oferta que no entra va como índice, y con `materia` trae las comisiones de una", async () => {
    // 200 materias con 3 comisiones cada una: bastante más que el presupuesto de una respuesta.
    const subjects = Array.from({ length: 200 }, (_, i) =>
        subject(`MATERIA ${i} (AB${i})`, commission(`AB${i}-A`), commission(`AB${i}-B`), commission(`AB${i}-C`)),
    );
    const session = serveOffer(period("2026 - 2º cuatrimestre", ...subjects));

    const whole = await openPage(session, "oferta_comisiones");
    assert.equal(whole.recortado, true);
    assert.match(String(whole.aviso), /`materia`/);
    assert.equal("oferta" in whole, false);
    const index = (whole as unknown as { indice: { materias: { codigo: string; comisiones: number }[] }[] }).indice;
    assert.equal(index[0].materias.length, 200);
    assert.deepEqual(index[0].materias[7], { materia: "MATERIA 7", codigo: "AB7", comisiones: 3 });

    const one = (await openPage(session, "oferta_comisiones", "AB7")) as unknown as { oferta: { materias: { comisiones: unknown[] }[] }[]; recortado?: boolean };
    assert.equal(one.recortado, undefined);
    assert.equal(one.oferta[0].materias.length, 1);
    assert.equal(one.oferta[0].materias[0].comisiones.length, 3);

    const none = await openPage(session, "oferta_comisiones", "no existe");
    assert.match(String(none.aviso), /Ninguna materia coincide/);
});
