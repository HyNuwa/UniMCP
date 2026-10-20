import assert from "node:assert/strict";
import { test } from "node:test";
import { academicHistory } from "../src/guarani/format/history.js";
import { argentinaDay } from "../src/shared/dates.js";

/** Una materia como la manda G3W, con datos inventados. */
const row = (title: string, span: string, info = "") =>
    `<div class="catedra"><div class="catedra_nombre"><h4>${title}</h4><span>${span} - <a href="#">Detalle</a></span></div>` +
    `<div class="toggle_info_catedra" style="display:none;">${info}<div><!-- Ajax --></div></div></div>`;

/** El día de la consulta en los tests, para que `vencida` no dependa del reloj. */
const TODAY = "2026-10-19";

/** El primer registro de la única materia de `html`. */
const first = (html: string) => academicHistory(html, TODAY)?.historia[0].registros[0];

test("nota con coma", () => {
    const r = first(row("M (A1)", "<strong>Examen</strong> - 6,50 (Seis con cincuenta) Aprobado 3/8/2026"));
    assert.deepEqual([r?.nota, r?.resultado, r?.fecha], [6.5, "Aprobado", "2026-08-03"]);
});

test("nota en letras minúsculas: 7 (siete)", () => {
    const r = first(row("M (A1)", "<strong>Examen </strong> - 7 (siete) Aprobado 12/12/2025"));
    assert.deepEqual([r?.nota, r?.resultado, r?.fecha], [7, "Aprobado", "2025-12-12"]);
});

test("ausente: sin nota", () => {
    const r = first(row("M (A1)", "<strong>Examen </strong> - Ausente 13/03/2026"));
    assert.deepEqual([r?.tipo, r?.nota, r?.resultado, r?.fecha], ["Examen", undefined, "Ausente", "2026-03-13"]);
});

test("libre: la regularidad no vale y no muestra vencimiento", () => {
    const r = first(row("M (A1)", "<strong>Regularidad </strong> - Libre 01/12/2025", "Vencimiento: 01/12/2027"));
    assert.deepEqual([r?.resultado, r?.vencimiento, r?.vencida], ["Libre", undefined, undefined]);
});

test("promocionado, con nota numérica o en palabras", () => {
    const html =
        row("M (A1)", "<strong>Promoción </strong> - 8 (Ocho) Promocionado 07/07/2026") +
        row("N (A2)", "<strong>Promoción </strong> - A (Acreditado) Promocionado 12/12/2024");
    const [m, n] = academicHistory(html, TODAY)!.historia.map((s) => s.registros[0]);
    assert.deepEqual([m.nota, m.resultado], [8, "Promocionado"]);
    assert.deepEqual([n.nota, n.resultado], ["Acreditado", "Promocionado"]);
});

test("equivalencia", () => {
    const r = first(row("M (A1)", "<strong>Equivalencia Total</strong> - 5 (Cinco) Aprobado 20/08/2026"));
    assert.deepEqual([r?.tipo, r?.nota, r?.resultado, r?.fecha], ["Equivalencia Total", 5, "Aprobado", "2026-08-20"]);
});

test("en curso: la fecha es el inicio de dictado", () => {
    const r = first(row("M (A1)", "<strong>En curso </strong> - Inicio de dictado 10/08/2026"));
    assert.deepEqual([r?.tipo, r?.resultado, r?.fecha], ["En curso", "Inicio de dictado", "2026-08-10"]);
});

test("la materia agrupa sus registros, del más reciente al más viejo y el final antes que la regularidad", () => {
    const html =
        row("MATERIA (AB1)", "<strong>Regularidad </strong> - Reprobado 10/07/2025", "Vencimiento: 04/07/2027") +
        row("MATERIA (AB1)", "<strong>Regularidad </strong> - Aprobado 07/07/2026", "Vencimiento: 10/07/2028") +
        row("MATERIA (AB1)", "<strong>Promoción </strong> - 9 (Nueve) Promocionado 07/07/2026");
    const h = academicHistory(html, TODAY)!;
    assert.equal(h.historia.length, 1);
    assert.deepEqual([h.historia[0].materia, h.historia[0].codigo], ["MATERIA", "AB1"]);
    assert.deepEqual(
        h.historia[0].registros.map((r) => [r.tipo, r.resultado, r.vencimiento]),
        [
            ["Promoción", "Promocionado", undefined],
            // Promocionada: el vencimiento de la regularidad ya no se muestra.
            ["Regularidad", "Aprobado", undefined],
            ["Regularidad", "Reprobado", undefined],
        ],
    );
});

test("vencida, contra la fecha de la consulta", () => {
    const html =
        row("VIGENTE (A1)", "<strong>Regularidad </strong> - Aprobado 08/07/2026", "Vencimiento: 10/07/2028") +
        row("VENCIDA (A2)", "<strong>Regularidad </strong> - Aprobado 07/07/2023", "Vencimiento: 07/07/2025") +
        row("HOY (A3)", "<strong>Regularidad </strong> - Aprobado 19/10/2024", "Vencimiento: 19/10/2026");
    const h = academicHistory(html, TODAY)!;
    assert.equal(h.fechaConsulta, TODAY);
    assert.deepEqual(
        h.historia.map((s) => [s.materia, s.registros[0].vencimiento, s.registros[0].vencida]),
        [
            ["VIGENTE", "2028-07-10", undefined],
            ["VENCIDA", "2025-07-07", true],
            // Vence hoy: todavía vale.
            ["HOY", "2026-10-19", undefined],
        ],
    );
});

test("lo que no tiene la forma conocida va como texto y se cuenta", () => {
    const h = academicHistory(
        row("M (A1)", "<strong>Créditos</strong> - otorgados por actividad extracurricular") +
            row("N (A2)", "<strong>Examen</strong> - 4 (Cuatro) Aprobado 01/03/2026"),
        TODAY,
    )!;
    assert.deepEqual(h.historia[0].registros[0], { tipo: "Créditos", texto: "otorgados por actividad extracurricular", vencimiento: undefined });
    assert.equal(h.registrosSinParsear, 1);
    assert.equal(academicHistory(row("N (A2)", "<strong>Examen</strong> - 4 (Cuatro) Aprobado 01/03/2026"), TODAY)?.registrosSinParsear, undefined);
});

test("una página sin historia no se estructura", () => {
    assert.equal(academicHistory("<table><tr><td>Algo</td></tr></table>", TODAY), undefined);
});

test("el día de la consulta es el de Argentina, no el de UTC", () => {
    // 01:00 UTC del 20 son las 22:00 del 19 en Argentina.
    assert.equal(argentinaDay(new Date("2026-10-20T01:00:00Z")), "2026-10-19");
    assert.equal(argentinaDay(new Date("2026-10-20T03:00:00Z")), "2026-10-20");
});
