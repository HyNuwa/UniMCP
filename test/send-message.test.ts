/**
 * Mandar un mensaje va en dos pasos y solo a alguien que comparte un curso: la vista previa dice a quién
 * le llega y con qué rol, y cada código sirve una vez. Un mensaje con datos tapados no sale.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { MAX_MESSAGE_CHARS, sendMessage } from "../src/aula-virtual/format/writes.js";

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

const TEACHER = 20;
const STRANGER = 30;

/** Un aula donde el usuario 7 cursa Física con el docente 20; el 30 existe pero no comparte cursos. */
function fakeAula() {
    const sent: string[] = [];
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        switch (params.get("wsfunction")) {
            case "core_webservice_get_site_info":
                return Response.json({ userid: 7 });
            case "core_message_get_member_info": {
                const id = Number(params.get("userids[0]"));
                return Response.json([{ id, fullname: id === TEACHER ? "Docente Uno" : "Otra Persona", isdeleted: false }]);
            }
            case "core_enrol_get_users_courses":
                return Response.json([{ id: 3, fullname: "Física  II", shortname: "FIS2", visible: 1 }]);
            case "core_user_get_course_user_profiles": {
                const id = Number(params.get("userlist[0][userid]"));
                return Response.json(id === TEACHER ? [{ id, roles: [{ name: "", shortname: "editingteacher" }] }] : []);
            }
            case "core_message_send_instant_messages":
                sent.push(params.get("messages[0][text]") ?? "");
                return Response.json([{ msgid: 1 }]);
        }
        throw new Error(`pedido inesperado: ${params.get("wsfunction")}`);
    }) as typeof fetch;
    return sent;
}

let session: AulaSession;
let tokens = 0;
beforeEach(() => {
    const token = `tok-msg-${tokens++}`;
    session = { site: { baseUrl: "https://aula.test" }, getToken: async () => token, refreshToken: async () => token };
});

type Preview = { vistaPrevia: string; para: string; rol: string; confirmacion: string };

test("la vista previa no manda nada y dice a quién le llega y con qué rol", async () => {
    const sent = fakeAula();
    const preview = (await sendMessage(session, TEACHER, "Profe, ¿hay clase el viernes?")) as Preview;
    assert.deepEqual(sent, []);
    assert.equal(preview.para, "Docente Uno");
    assert.equal(preview.rol, "docente en Física II");
    assert.ok(preview.confirmacion);
});

test("con el código se manda una vez, y el mismo código no sirve de nuevo", async () => {
    const sent = fakeAula();
    const text = "Profe, ¿hay clase el viernes?";
    const { confirmacion } = (await sendMessage(session, TEACHER, text)) as Preview;
    assert.deepEqual(await sendMessage(session, TEACHER, text, confirmacion), { enviado: true, para: "Docente Uno" });
    await assert.rejects(sendMessage(session, TEACHER, text, confirmacion), /ya se usó/);
    assert.equal(sent.length, 1);
});

test("el código no sirve para otro texto ni para otro destinatario", async () => {
    const sent = fakeAula();
    const { confirmacion } = (await sendMessage(session, TEACHER, "Hola")) as Preview;
    await assert.rejects(sendMessage(session, TEACHER, "Hola, otra cosa", confirmacion), /no es lo de la vista previa/);
    assert.deepEqual(sent, []);
});

test("a quien no comparte ningún curso no se le escribe", async () => {
    const sent = fakeAula();
    await assert.rejects(sendMessage(session, STRANGER, "Hola"), /no comparte ningún curso con vos/);
    assert.deepEqual(sent, []);
});

test("un mensaje con datos tapados o demasiado largo no sale", async () => {
    const sent = fakeAula();
    await assert.rejects(sendMessage(session, TEACHER, "Los inscriptos: Ana [DNI], Juan [email]"), /parece copiado/);
    await assert.rejects(sendMessage(session, TEACHER, "[Lista de 34 personas con sus datos…]"), /parece copiado/);
    await assert.rejects(sendMessage(session, TEACHER, "a".repeat(MAX_MESSAGE_CHARS + 1)), /acortalo/);
    assert.deepEqual(sent, []);
});
