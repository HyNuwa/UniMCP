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
