import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlToText, safeUrl } from "../src/shared/html.js";

const links = { base: "https://aula.test" };

test("los videos de YouTube quedan como youtu.be/ID, con el segundo de inicio", () => {
    const cases: [string, string | undefined][] = [
        ["https://www.youtube.com/embed/iCAadj5DM8U?si=lT3nZtWgshsqoa7S", "https://youtu.be/iCAadj5DM8U"],
        ["//www.youtube.com/embed/abc123?autoplay=1&start=90", "https://youtu.be/abc123?t=90"],
        ["https://youtube.com/watch?v=kXa3BRRdIH8&t=45s&list=X", "https://youtu.be/kXa3BRRdIH8?t=45"],
        ["https://m.youtube.com/shorts/AbCdEf12", "https://youtu.be/AbCdEf12"],
        ["https://www.youtube-nocookie.com/embed/pyZi1H0B4jQ", "https://youtu.be/pyZi1H0B4jQ"],
        // Lo que no es un video queda como está.
        ["https://www.youtube.com/channel/UCxyz", "https://www.youtube.com/channel/UCxyz"],
        ["https://notyoutube.com/embed/abc123", "https://notyoutube.com/embed/abc123"],
    ];
    for (const [raw, expected] of cases) assert.equal(safeUrl(raw, links), expected, raw);
});

test("un iframe de YouTube se muestra con la URL corta", () => {
    const text = htmlToText('<iframe src="https://www.youtube.com/embed/iCAadj5DM8U?si=x&amp;autoplay=1"></iframe>', { links });
    assert.equal(text, "[Contenido incrustado: https://youtu.be/iCAadj5DM8U]");
});

test("una URL pegada como texto sin credenciales no se toca", () => {
    assert.equal(htmlToText("<p>Ver https://x.test y https://y.test/a?b=1.</p>"), "Ver https://x.test y https://y.test/a?b=1.");
});

/** Las líneas de una tabla, sin el resto del texto. */
const tableLines = (html: string) => htmlToText(html).split("\n");

test("oferta de comisiones de UNJu: la fila de la comisión, las observaciones y los horarios", () => {
    // Fragmento real de `oferta_comisiones` (G3W, UNJu) con los datos reemplazados.
    const html =
        '<table class="table table-bordered table-condensed comision" comision="1" sede="1" docentes="X"><tbody>' +
        '<tr class="comision"><th colspan="1"><h5>Comisión: AB001-COM1</h5></th>' +
        '<td colspan="2" class="detalle_comision"><span><strong>Turno:</strong> Mañana </span><span><strong>Cupo / insc.:</strong> 40 / 12 </span></td>' +
        '<td colspan="1" class="detalle_comision"><span><strong>Instancias:</strong> Regularidad/Promoción </span>' +
        "<span><strong>Ubicación:</strong> Sede Centro </span><span><strong>Docentes:</strong> DOCENTE UNO (Docente a cargo)</span></td></tr>" +
        '<tr class="comision"><td colspan="4" class="detalle_comision observaciones"><strong>Observaciones: </strong> Expediente 123 </td></tr>' +
        '<tr class="horarios encabezados"><th class="tipo_curso">Tipo de clase</th><th class="dia">Día</th><th class="horario">Horario</th><th class="aula">Aula</th></tr>' +
        '<tr class="js-dia horarios oscuro visible" dia_sem="Lunes" comision="1"><td> Teórica </td><td>Lunes</td><td> 08:00 a 10:00 </td><td> Aula 5 </td></tr>' +
        '<tr class="js-dia horarios oscuro visible" dia_sem="Jueves" comision="1"><td> Práctica </td><td>Jueves</td><td> 14:00 a 16:00 </td><td> Aula 7 </td></tr>' +
        "</tbody></table>";
    assert.deepEqual(tableLines(html), [
        // El colspan de los datos va una vez: sin celdas vacías de relleno.
        "Comisión: AB001-COM1 | Turno: Mañana Cupo / insc.: 40 / 12 | Instancias: Regularidad/Promoción Ubicación: Sede Centro Docentes: DOCENTE UNO (Docente a cargo)",
        "Observaciones: Expediente 123",
        "Tipo de clase | Día | Horario | Aula",
        "Teórica | Lunes | 08:00 a 10:00 | Aula 5",
        "Práctica | Jueves | 14:00 a 16:00 | Aula 7",
    ]);
});

test("encabezado de dos filas armado con td: un nombre por columna", () => {
    // La forma de la tabla de horarios de una cátedra del aula, con datos inventados.
    const html =
        "<table><tbody>" +
        '<tr><td rowspan="2">Comisión</td><td rowspan="2">1ra clase (virtual)</td><td colspan="2">2da clase</td><td colspan="2">3ra clase</td></tr>' +
        "<tr><td>Día y horario</td><td>Lugar</td><td>Día y horario</td><td>Lugar</td></tr>" +
        "<tr><td>C1</td><td>Lunes 8 a 10</td><td>Martes 12 a 14</td><td>Aula 1</td><td>Jueves 8 a 10</td><td>Aula 2</td></tr>" +
        "<tr><td>C2</td><td>Lunes 10 a 12</td><td>Martes 14 a 16</td><td>Virtual</td><td>Jueves 10 a 12</td><td>Aula 3</td></tr>" +
        "</tbody></table>";
    assert.deepEqual(tableLines(html), [
        "Comisión | 1ra clase (virtual) | 2da clase · Día y horario | 2da clase · Lugar | 3ra clase · Día y horario | 3ra clase · Lugar",
        "C1 | Lunes 8 a 10 | Martes 12 a 14 | Aula 1 | Jueves 8 a 10 | Aula 2",
        "C2 | Lunes 10 a 12 | Martes 14 a 16 | Virtual | Jueves 10 a 12 | Aula 3",
    ]);
});

test("thead de dos filas de th", () => {
    const html =
        '<table><thead><tr><th rowspan="2">Materia</th><th colspan="2">Parcial</th></tr><tr><th>Fecha</th><th>Nota</th></tr></thead>' +
        "<tbody><tr><td>Física</td><td>01/10</td><td>8</td></tr></tbody></table>";
    assert.deepEqual(tableLines(html), ["Materia | Parcial · Fecha | Parcial · Nota", "Física | 01/10 | 8"]);
});

test("un rowspan en los datos se repite en cada fila, y una fila sin celdas propias no sale", () => {
    const html =
        "<table><tr><th>Docente</th><th>Horario</th><th>Lugar</th></tr>" +
        '<tr><td>Docente A</td><td>Lunes 10</td><td rowspan="3">Gabinete</td></tr>' +
        "<tr><td>Docente B</td><td>Martes 11</td></tr>" +
        "<tr><td></td><td></td></tr></table>";
    assert.deepEqual(tableLines(html), ["Docente | Horario | Lugar", "Docente A | Lunes 10 | Gabinete", "Docente B | Martes 11 | Gabinete"]);
});

test("una tabla anidada queda en la celda, con sus filas separadas por /", () => {
    const html =
        "<table><tr><th>Comisión</th><th>Horarios</th></tr>" +
        "<tr><td>C1</td><td><table><tr><td>Lunes</td><td>8 a 10</td></tr><tr><td>Jueves</td><td>14 a 16</td></tr></table></td></tr></table>";
    assert.deepEqual(tableLines(html), ["Comisión | Horarios", "C1 | Lunes | 8 a 10 / Jueves | 14 a 16"]);
});

test("una tabla de puros th, sin datos, no se combina como encabezado", () => {
    assert.deepEqual(tableLines("<table><tr><th>Período: 2026</th></tr><tr><th>Docente:</th></tr></table>"), ["Período: 2026", "Docente:"]);
});
