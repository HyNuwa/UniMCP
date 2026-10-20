/**
 * Ninguna respuesta le muestra al modelo una credencial: ni el token del usuario ni parámetros como
 * `token`, `wstoken` o `sesskey` que vengan en el HTML de los docentes o de Guaraní. Las respuestas de
 * Moodle y de G3W son inventadas y llevan credenciales en todos los lugares por donde puede salir una URL.
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { CookieJar } from "tough-cookie";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { open } from "../src/aula-virtual/format/navigation.js";
import { search } from "../src/aula-virtual/format/search.js";
import type { GuaraniSession } from "../src/guarani/client/session.js";
import { openMenu, openPage } from "../src/guarani/format/page.js";

/** El token del usuario: lo único que de verdad no puede salir. */
const TOKEN = "tok5ecret0f7heu5er";
/** Credenciales que pegó un docente o que trae una página. */
const SECRETS = [TOKEN, "s3sskeyd0cente", "wst0kenpegad0", "gu4ran1t0ken"];
/** Un parámetro de credencial en cualquier URL, aunque su valor no sea uno de los de arriba. */
const CREDENTIAL_PARAM = /[?&;](token|wstoken|sesskey)=/i;

function assertClean(output: unknown) {
    const text = typeof output === "string" ? output : JSON.stringify(output);
    for (const secret of SECRETS) assert.ok(!text.includes(secret), `Se filtró "${secret}":\n${text}`);
    assert.doesNotMatch(text, CREDENTIAL_PARAM);
}

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

function mockFetch(handler: (url: URL, body: URLSearchParams) => unknown) {
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        const result = handler(url, body);
        return typeof result === "string"
            ? new Response(result, { headers: { "content-type": "text/html; charset=utf-8" } })
            : Response.json(result);
    }) as typeof fetch;
}

describe("aula", () => {
    const AULA = "https://aula.test";
    const session: AulaSession = {
        site: { baseUrl: AULA },
        getToken: async () => TOKEN,
        refreshToken: async () => TOKEN,
    };
    const file = (name: string) => ({
        type: "file",
        filename: name,
        filepath: "/",
        filesize: 10,
        fileurl: `${AULA}/webservice/pluginfile.php/1/mod_resource/content/0/${name}?forcedownload=1&token=${TOKEN}`,
        timemodified: 1_760_000_000,
    });
    const teacherHtml =
        `<p>Clase <a href="${AULA}/mod/quiz/view.php?id=5&amp;sesskey=s3sskeyd0cente">LINK</a> y la guía ` +
        `<a href="/webservice/pluginfile.php/2/a.pdf?token=${TOKEN}">acá</a>. Pegada: ` +
        `https://meet.test/sala?wstoken=wst0kenpegad0&amp;x=1</p>` +
        `<iframe src="https://docs.test/d?token=${TOKEN}&amp;embedded=true"></iframe>` +
        `<img src="${AULA}/webservice/pluginfile.php/3/foto.png?token=${TOKEN}">`;
    const sections = [
        {
            id: 1,
            name: "Unidad 1",
            section: 1,
            summary: teacherHtml,
            modules: [
                { id: 10, name: "Etiqueta", modname: "label", instance: 1, uservisible: true, description: teacherHtml },
                {
                    id: 11,
                    name: "Guía de parcial",
                    modname: "resource",
                    instance: 2,
                    uservisible: true,
                    url: `${AULA}/mod/resource/view.php?id=11&token=${TOKEN}`,
                    description: teacherHtml,
                    contents: [file("guia.pdf")],
                },
                {
                    id: 12,
                    name: "Link de la clase",
                    modname: "url",
                    instance: 3,
                    uservisible: true,
                    contents: [{ ...file("x"), type: "url", fileurl: `https://meet.test/c?sesskey=s3sskeyd0cente` }],
                },
                { id: 13, name: "Avisos parcial", modname: "forum", instance: 4, uservisible: true },
            ],
        },
    ];
    const discussion = {
        id: 1,
        discussion: 100,
        subject: "Parcial",
        message: teacherHtml,
        userfullname: "Docente",
        userid: 2,
        created: 1_760_000_000,
        timemodified: 1_760_000_000,
        numreplies: 0,
        pinned: false,
        attachment: true,
    };
    const post = {
        id: 1000,
        subject: "Parcial",
        replysubject: "Re: Parcial",
        message: teacherHtml,
        author: { id: 2, fullname: "Docente" },
        timecreated: 1_760_000_000,
        parentid: null,
        isdeleted: false,
        capabilities: { reply: true, edit: false, delete: false },
        attachments: [file("enunciado.pdf")],
    };
    const moodle: Record<string, unknown> = {
        core_webservice_get_site_info: { userid: 1, username: "alumno" },
        core_enrol_get_users_courses: [{ id: 7, shortname: "C", fullname: "Curso", visible: 1 }],
        core_course_get_contents: sections,
        mod_forum_get_forum_discussions: { discussions: [discussion] },
        mod_forum_can_add_discussion: { status: false },
        mod_forum_get_discussion_posts: { posts: [post] },
    };

    test("cada nivel de aula_open", async () => {
        mockFetch((_, body) => moodle[body.get("wsfunction") ?? ""] ?? { exception: "x", errorcode: "x" });
        for (const address of ["/", "/curso/7", "/curso/7/sec/1", "/curso/7/mod/10", "/curso/7/mod/11", "/curso/7/mod/12", "/curso/7/mod/13", "/curso/7/mod/13/disc/100"]) {
            assertClean(await open(session, address));
        }
        // Las URLs siguen ahí, solo sin la credencial: el test no pasa por una respuesta vacía.
        const course = JSON.stringify(await open(session, "/curso/7"));
        assert.match(course, /https:\/\/meet\.test\/sala\?x=1/);
        assert.match(course, /pluginfile\.php\/1\/mod_resource\/content\/0\/guia\.pdf\?forcedownload=1/);
    });

    test("aula_search", async () => {
        mockFetch((_, body) => moodle[body.get("wsfunction") ?? ""]);
        assertClean(await search(session, "parcial"));
        assertClean(await search(session, "clase"));
    });

    test("los errores de Moodle", async () => {
        mockFetch(() => ({ exception: "moodle_exception", errorcode: "nopermissions", message: "Sin permiso" }));
        await assert.rejects(open(session, "/curso/7"), (e: Error) => (assertClean(e.message), true));
        globalThis.fetch = (async () => {
            throw new Error("conexión rechazada");
        }) as typeof fetch;
        await assert.rejects(open(session, "/curso/7"), (e: Error) => (assertClean(e.message), true));
    });
});

describe("guaraní", () => {
    const G3W = "https://g3w.test/autogestion";
    const jar = new CookieJar();
    const session: GuaraniSession = {
        site: { baseUrl: G3W },
        getJar: async () => jar,
        renew: async () => jar,
        save: async () => {},
    };
    const pagelet = (id: string, content: string) =>
        `<script>kernel.renderer.on_arrival(${JSON.stringify({ op: "inicio_alumno", info: { id }, content })});</script>`;
    const page =
        `<html><body><ul class="menu"><li><a href="${G3W}/historia_academica?token=gu4ran1t0ken">Historia</a></li>` +
        `<li><a href="/autogestion/mensajes?sesskey=s3sskeyd0cente">3</a></li></ul>` +
        `<a class="js-select-carreras selected" data-carrera-id="1">Ingeniería</a>` +
        pagelet(
            "info",
            `<p>Material en https://drive.test/f?token=gu4ran1t0ken y <a href="${G3W}/plan?wstoken=wst0kenpegad0">plan</a></p>` +
                `<div class="alert">Ver https://x.test/?sesskey=s3sskeyd0cente</div>`,
        ) +
        `</body></html>`;

    test("guarani_menu y guarani_open", async () => {
        mockFetch(() => page);
        assertClean(await openMenu(session));
        assertClean(await openPage(session, ""));
        assertClean(await openPage(session, `plan?wstoken=wst0kenpegad0`));
        const menu = JSON.stringify(await openMenu(session));
        assert.match(menu, /"direccion":"historia_academica"/);
        assert.match(JSON.stringify(await openPage(session, "")), /https:\/\/drive\.test\/f/);
    });
});
