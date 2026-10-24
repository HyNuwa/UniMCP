/**
 * Datos de otras personas en el texto del aula (#17), con datos inventados: las listas se resumen y los
 * DNI, emails y teléfonos sueltos de otros se tapan.
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { AulaSession } from "../src/aula-virtual/client/session.js";
import { createServer } from "../src/mcp-server.js";
import { UploadInbox } from "../src/shared/uploads.js";
import { protectText, thirdPartyDataShown, withoutThirdPartyData } from "../src/shared/privacy.js";

const ana = { fullname: "Ana María Pérez", username: "40123456" };

describe("listas de personas", () => {
    const ROSTER = [
        "# Alumnos en condición de baja",
        "Apellido y nombre | DNI | Condición",
        "GÓMEZ, Juan | 41.222.333 | Libre",
        "PEREZ, Ana Maria | 40.123.456 | Regular",
        "SOSA, Lucía | 42555666 | Libre",
        "Los que figuran deben regularizar antes del viernes.",
    ].join("\n");

    test("una tabla de alumnos se resume y dice si figurás", () => {
        const out = protectText(ROSTER, ana);
        assert.match(out, /^# Alumnos en condición de baja\n\[Lista de 3 personas con sus datos \(Apellido y nombre \| DNI \| Condición\)/);
        assert.match(out, /figurás en la fila 2: «PEREZ, Ana Maria \| 40\.123\.456 \| Regular»/);
        assert.match(out, /\nLos que figuran deben regularizar antes del viernes\.$/);
        for (const other of ["GÓMEZ", "41.222.333", "SOSA", "42555666"]) assert.ok(!out.includes(other), other);
    });

    test("si no figurás, también lo dice", () => {
        const out = protectText(ROSTER, { fullname: "Carla Ruiz", username: "39000111" });
        assert.match(out, /\[Lista de 3 personas.*no figurás/);
        assert.ok(!out.includes("PEREZ"));
    });

    test("una lista sin encabezado, con DNI o email en cada línea (como sale de un PDF)", () => {
        const out = protectText(
            ["- Juan Gómez 41222333", "- Lucía Sosa lucia.sosa@gmail.com", "- Pedro Díaz 43111222", "Fin."].join("\n"),
            ana,
        );
        assert.equal(out, "[Lista de 3 personas con sus datos; UniMCP no la muestra: no figurás (te busqué por tu nombre y tu usuario del aula).]\nFin.");
    });

    test("tu fila se encuentra por tu usuario aunque el nombre esté distinto", () => {
        const out = protectText(["P., A. | 40123456", "G., J. | 41222333", "S., L. | 42555666"].join("\n"), ana);
        assert.match(out, /figurás en la fila 1/);
    });

    test("dos filas de tabla con DNI ya son una lista", () => {
        const text = ["Dados de baja:", "L004512 | GÓMEZ, Juan | DNI 41222333", "L004873 | SOSA, Lucía | DNI 42555666"];
        const out = protectText(text.join("\n"), ana);
        assert.match(out, /^Dados de baja:\n\[Lista de 2 personas con sus datos; UniMCP no la muestra: no figurás/);
        assert.ok(!out.includes("GÓMEZ") && !out.includes("SOSA"));
    });

    test("una tabla de legajos y nombres, sin DNI", () => {
        const out = protectText(["L004512 | Gómez, Juan", "L004873 | Sosa, Lucía", "Materia IF159 | Comisión A"].join("\n"), ana);
        assert.match(out, /^\[Lista de 2 personas/);
        assert.match(out, /\nMateria IF159 \| Comisión A$/);
    });

    test("dos líneas sueltas con datos no son una lista: se tapan sueltas", () => {
        assert.equal(protectText("Juan 41222333\nLucía 42555666", ana), "Juan [DNI]\nLucía [DNI]");
    });
});

describe("datos sueltos", () => {
    test("tapa DNI, emails y teléfonos de otros", () => {
        assert.equal(
            protectText("Escribile a juan.gomez@gmail.com o al 388 4123456 (+54 9 388 412-3456). DNI 41.222.333.", ana),
            "Escribile a [email] o al [teléfono] ([teléfono]). DNI [DNI].",
        );
    });

    test("deja los tuyos y los de contacto de la cátedra", () => {
        const text = "Tu DNI 40123456. Consultas a algebra@fi.unju.edu.ar o catedra.fisica@gmail.com.";
        assert.equal(protectText(text, ana), text);
    });

    test("tapa un email institucional que lleva un DNI", () => {
        assert.equal(protectText("De 41222333@fi.unju.edu.ar", ana), "De [email]");
    });

    test("no toca números que no son de personas ni URLs", () => {
        const text = [
            "ID de reunión: 845 1234 5678, código 123456",
            "Clase en https://meet.google.com/abc-defg-hij y https://aula.test/pluginfile.php/41222333/a.pdf",
            "Res. 12345678 del 20/10/2026 a las 18:30, aula 204, $ 1500",
        ].join("\n");
        assert.equal(protectText(text, ana), text);
    });

    test("en la respuesta, solo los textos: no las direcciones, los números ni las URLs", () => {
        const response = {
            direccion: "/curso/691/mod/41222333",
            id: 41222333,
            discusiones: [{ asunto: "Notas", mensaje: "Juan (41222333) aprobó", url: "https://aula.test/x?id=41222333" }],
        };
        assert.deepEqual(withoutThirdPartyData(response, ana), {
            direccion: "/curso/691/mod/41222333",
            id: 41222333,
            discusiones: [{ asunto: "Notas", mensaje: "Juan ([DNI]) aprobó", url: "https://aula.test/x?id=41222333" }],
        });
    });
});

test("se apaga solo en local y con UNI_SHOW_THIRD_PARTY_DATA=1", () => {
    assert.equal(thirdPartyDataShown(true, "1"), true);
    assert.equal(thirdPartyDataShown(true, undefined), false);
    assert.equal(thirdPartyDataShown(false, "1"), false);
});

describe("en las tools del aula", () => {
    const realFetch = globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = realFetch;
        delete process.env.UNI_SHOW_THIRD_PARTY_DATA;
    });

    const roster =
        "<p>Quedan libres:</p><table><tr><th>Alumno</th><th>DNI</th></tr>" +
        "<tr><td>Gómez, Juan</td><td>41222333</td></tr><tr><td>Sosa, Lucía</td><td>42555666</td></tr>" +
        "<tr><td>Díaz, Pedro</td><td>43111222</td></tr></table>";

    /** El texto de aula_list_messages de una conversación con `roster`, por STDIO o por HTTP. */
    async function conversation(local: boolean): Promise<string> {
        globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
            const params = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : "");
            if (params.get("wsfunction") === "core_webservice_get_site_info") {
                return Response.json({ userid: 7, username: "40123456", fullname: "Ana Pérez" });
            }
            return Response.json({ id: 1, members: [{ id: 50, fullname: "Prof. Ruiz" }], messages: [
                { id: 1, useridfrom: 50, text: roster, timecreated: 1_760_000_000 },
            ] });
        }) as typeof fetch;
        const session: AulaSession = {
            site: { baseUrl: "https://aula.test" },
            getToken: async () => `tok-${local}-${process.env.UNI_SHOW_THIRD_PARTY_DATA}`,
            refreshToken: async () => "tok",
        };
        const files = local
            ? { local: true as const }
            : { local: false as const, inbox: new UploadInbox("https://mcp.test"), owner: "1" };
        const [client, transport] = InMemoryTransport.createLinkedPair();
        await createServer({ aula: session }, files, "all").connect(transport);
        const results = new Map<number, (r: unknown) => void>();
        client.onmessage = (m) => {
            const { id, result } = m as { id?: number; result?: unknown };
            if (id !== undefined) results.get(id)?.(result);
        };
        await client.start();
        const request = <T>(id: number, method: string, params: object) =>
            new Promise<T>((resolve) => {
                results.set(id, resolve as (r: unknown) => void);
                void client.send({ jsonrpc: "2.0", id, method, params });
            });
        await request(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
        const { content } = await request<{ content: { text: string }[] }>(2, "tools/call", {
            name: "aula_list_messages",
            arguments: { conversacion: 1 },
        });
        await client.close();
        return content[0].text;
    }

    test("una lista de alumnos en un mensaje llega resumida, por STDIO y por HTTP", async () => {
        for (const local of [true, false]) {
            const text = await conversation(local);
            assert.match(text, /Quedan libres:/);
            assert.match(text, /\[Lista de 3 personas con sus datos \(Alumno \| DNI\).*no figurás/);
            assert.ok(!text.includes("Gómez") && !text.includes("41222333"), text);
        }
    });

    test("con UNI_SHOW_THIRD_PARTY_DATA=1 se ve entera, pero solo en local", async () => {
        process.env.UNI_SHOW_THIRD_PARTY_DATA = "1";
        assert.match(await conversation(true), /Gómez, Juan \| 41222333/);
        assert.ok(!(await conversation(false)).includes("41222333"));
    });
});
