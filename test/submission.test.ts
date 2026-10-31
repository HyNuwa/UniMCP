/**
 * Entregar va en dos pasos: sin `confirmacion` no se cambia nada y se ve qué archivos se suman, quedan y
 * se quitan; con el código de esa vista previa, y solo si nada cambió, se entrega.
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { submitAssignment, type SubmissionRequest } from "../src/aula-virtual/format/submission.js";
import { confirmationProblem, CONFIRMATION_TTL_MS, issueConfirmation } from "../src/shared/confirmation.js";

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

const OLD_URL = "https://aula.test/webservice/pluginfile.php/1/assignsubmission_file/submission_files/9/viejo.pdf";
const ADDRESS = "/curso/3/mod/50";
const local = { local: true } as const;

/** Un aula con una tarea que acepta archivos y texto, y una entrega con `viejo.pdf`. */
function fakeAula(functions = ["mod_assign_save_submission", "mod_assign_remove_submission"]) {
    const state = {
        files: [{ filename: "viejo.pdf", filesize: 4, fileurl: OLD_URL, timemodified: 100 }],
        text: "",
        timemodified: 100,
        saves: 0,
        removes: 0,
    };
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/webservice/upload.php")) return Response.json([{ itemid: 99 }]);
        if (url.startsWith(OLD_URL)) return new Response(new Uint8Array([1, 2, 3, 4]));
        const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
        switch (params.get("wsfunction")) {
            case "core_webservice_get_site_info":
                return Response.json({ userid: 7, functions: functions.map((name) => ({ name })) });
            case "core_course_get_contents":
                return Response.json([
                    { name: "Unidad 1", modules: [{ id: 50, instance: 5, modname: "assign", name: "TP1", uservisible: true }] },
                ]);
            case "mod_assign_get_assignments":
                return Response.json({
                    courses: [
                        {
                            assignments: [
                                {
                                    id: 5,
                                    cmid: 50,
                                    duedate: 1_800_000_000,
                                    cutoffdate: 0,
                                    submissiondrafts: 0,
                                    requiresubmissionstatement: 0,
                                    teamsubmission: 0,
                                    maxattempts: -1,
                                    configs: [
                                        { subtype: "assignsubmission", plugin: "file", name: "enabled", value: "1" },
                                        { subtype: "assignsubmission", plugin: "file", name: "maxfilesubmissions", value: "5" },
                                        { subtype: "assignsubmission", plugin: "onlinetext", name: "enabled", value: "1" },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            case "mod_assign_get_submission_status":
                return Response.json({
                    lastattempt: {
                        canedit: true,
                        submission: {
                            status: "submitted",
                            timemodified: state.timemodified,
                            plugins: [
                                { type: "file", fileareas: [{ files: state.files }] },
                                { type: "onlinetext", editorfields: [{ name: "onlinetext", text: state.text, format: 1 }] },
                            ],
                        },
                    },
                });
            case "mod_assign_save_submission":
                state.saves++;
                state.timemodified++;
                state.text = params.get("plugindata[onlinetext_editor][text]") ?? state.text;
                return Response.json([]);
            case "mod_assign_remove_submission":
                state.removes++;
                return Response.json({ status: true, warnings: [] });
            case "core_files_get_unused_draft_itemid":
                return Response.json({ itemid: 3 });
        }
        throw new Error(`pedido inesperado: ${params.get("wsfunction") ?? url}`);
    }) as typeof fetch;
    return state;
}

let session: AulaSession;
let tokens = 0;
beforeEach(() => {
    // Un token distinto por test, para que no se mezcle la caché de site_info.
    const token = `tok-${tokens++}`;
    session = { site: { baseUrl: "https://aula.test" }, getToken: async () => token, refreshToken: async () => token };
});

function newFile(name: string, content = "contenido") {
    const path = join(mkdtempSync(join(tmpdir(), "unimcp-")), name);
    writeFileSync(path, content);
    return path;
}

const request = (overrides: Partial<SubmissionRequest>): SubmissionRequest => ({ send: true, acceptStatement: false, ...overrides });

type Preview = { vistaPrevia: string; confirmacion: string; archivos?: Record<string, string[]>; borraLaEntrega?: boolean };

test("sin confirmacion no escribe y muestra que el archivo anterior se quita", async () => {
    const state = fakeAula();
    const result = (await submitAssignment(session, ADDRESS, request({ files: [newFile("TP1.pdf")] }), local)) as Preview;
    assert.equal(state.saves, 0);
    assert.match(result.vistaPrevia, /no se entregó nada/);
    assert.deepEqual(result.archivos, { seSuman: ["TP1.pdf"], quedan: [], seQuitan: ["viejo.pdf"] });
    assert.ok(result.confirmacion);
});

test("con el código de la vista previa entrega, y el mismo código no sirve dos veces", async () => {
    const state = fakeAula();
    const files = [OLD_URL.replace("/webservice", ""), newFile("TP1.pdf")];
    const { confirmacion, archivos } = (await submitAssignment(session, ADDRESS, request({ files }), local)) as Preview;
    assert.deepEqual(archivos, { seSuman: ["TP1.pdf"], quedan: ["viejo.pdf"], seQuitan: [] });

    await submitAssignment(session, ADDRESS, request({ files, confirmation: confirmacion }), local);
    assert.equal(state.saves, 1);
    await assert.rejects(
        submitAssignment(session, ADDRESS, request({ files, confirmation: confirmacion }), local),
        /ya se usó|cambió desde entonces/,
    );
    assert.equal(state.saves, 1);
});

test("un código no sirve para otro contenido que el de su vista previa", async () => {
    const state = fakeAula();
    const { confirmacion } = (await submitAssignment(session, ADDRESS, request({ text: "Versión A" }), local)) as Preview;
    await assert.rejects(
        submitAssignment(session, ADDRESS, request({ text: "Versión B", confirmation: confirmacion }), local),
        /no es lo de la vista previa/,
    );
    assert.equal(state.saves, 0);
});

test("un archivo que cambió después de la vista previa invalida el código", async () => {
    const state = fakeAula();
    const path = newFile("TP1.pdf", "primera");
    const { confirmacion } = (await submitAssignment(session, ADDRESS, request({ files: [path] }), local)) as Preview;
    writeFileSync(path, "segunda");
    await assert.rejects(
        submitAssignment(session, ADDRESS, request({ files: [path], confirmation: confirmacion }), local),
        /no es lo de la vista previa/,
    );
    assert.equal(state.saves, 0);
});

test("dejarla sin nada avisa que borra la entrega, y si el aula no deja, lo dice antes", async () => {
    fakeAula();
    const empty = request({ files: [], text: "" });
    const result = (await submitAssignment(session, ADDRESS, empty, local)) as Preview;
    assert.equal(result.borraLaEntrega, true);

    const state = fakeAula(["mod_assign_save_submission"]);
    session = { ...session, getToken: async () => "tok-sin-borrar" };
    await assert.rejects(submitAssignment(session, ADDRESS, empty, local), /no deja borrar la entrega entera/);
    assert.equal(state.removes, 0);
});

test("un código vencido o mal copiado no vale", () => {
    const code = issueConfirmation("huella", 0);
    assert.match(confirmationProblem(code, "huella", CONFIRMATION_TTL_MS + 1) ?? "", /venció/);
    assert.equal(confirmationProblem(code, "huella", 1), undefined);
    assert.match(confirmationProblem(code, "huella", 2) ?? "", /ya se usó/);
    assert.match(confirmationProblem("basura", "huella") ?? "", /no es válido/);
    // Cambiar el vencimiento rompe la firma: no se puede estirar.
    const [, mac] = code.split(".");
    assert.match(confirmationProblem(`${Date.now() + 60_000}.${mac}`, "huella") ?? "", /no es lo de la vista previa/);
});
