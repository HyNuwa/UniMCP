#!/usr/bin/env node

import "./shared/load-env.js";
import { parseArgs } from "node:util";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { LocalSession } from "./aula-virtual/client/local-session.js";
import { StoredAulaSession } from "./aula-virtual/client/hosted-session.js";
import { LocalGuaraniSession } from "./guarani/client/local-session.js";
import { campusOf, startHttpServer, userIdOf } from "./http-server.js";
import { runLogin } from "./login.js";
import { accessPolicyFromEnv } from "./oauth/access.js";
import { redirectAllowlistFromEnv } from "./oauth/redirects.js";
import { createServer } from "./mcp-server.js";
import { localCampus, requireCampus } from "./shared/campus.js";
import { logger } from "./shared/logger.js";
import { SqliteStore } from "./shared/store/sqlite-store.js";
import { UploadInbox } from "./shared/uploads.js";

const USAGE = `Uso:
  mcp-uni-arg                 servidor MCP por STDIO (lo lanza el cliente)
  mcp-uni-arg --http [--host H] [--port N]  servidor MCP por HTTP (por defecto 127.0.0.1:3000)
  mcp-uni-arg login           elegir tu campus y guardar las credenciales del aula y de SIU Guaraní
  mcp-uni-arg login --http    lo mismo, para el modo HTTP: guarda la sesión del aula y emite el token del cliente

Si hay un .env en la carpeta actual, se lee al arrancar (ver .env.example).`;

async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            http: { type: "boolean", default: false },
            // Por defecto escucha solo en esta máquina; hosteado, en `0.0.0.0` detrás del reverse
            // proxy.
            host: { type: "string", default: process.env.HOST ?? "127.0.0.1" },
            port: { type: "string", default: process.env.PORT ?? "3000" },
            help: { type: "boolean", short: "h", default: false },
        },
    });

    if (values.help) {
        console.error(USAGE);
        return;
    }
    if (positionals[0] === "login") {
        await runLogin(values.http);
        return;
    }

    if (values.http) {
        // Cada request llega con el token de un usuario del store y se atiende con su sesión. Los
        // archivos entran por links de subida, porque el servidor puede no estar en la compu de quien
        // entrega.
        const port = Number(values.port);
        const publicUrl = process.env.MCP_UNI_PUBLIC_URL?.replace(/\/+$/, "") || undefined;
        const baseUrl = publicUrl ?? `http://127.0.0.1:${port}`;
        // Por defecto, el `/login` de este mismo servidor, salvo que quien lo hostea configure otra
        // página.
        const loginUrl = process.env.MCP_UNI_LOGIN_URL || `${baseUrl}/login`;
        const store = await SqliteStore.open();
        const inbox = new UploadInbox(baseUrl);
        const factory = (ctx: { authInfo?: AuthInfo }) => {
            // Cada usuario pertenece a un campus; en HTTP solo está el aula (Guaraní requiere la
            // contraseña guardada).
            const userId = userIdOf(ctx.authInfo);
            const campus = requireCampus(campusOf(ctx.authInfo));
            const aula = campus.aula && new StoredAulaSession(campus.aula, store, userId, loginUrl);
            return createServer({ aula }, { local: false, inbox, owner: String(userId) });
        };
        const options = {
            host: values.host,
            port,
            publicUrl,
            access: accessPolicyFromEnv(),
            redirects: redirectAllowlistFromEnv(),
            adminSecret: process.env.MCP_UNI_ADMIN_SECRET || undefined,
        };
        startHttpServer(factory, options, store, inbox);
    } else {
        // STDIO: un único usuario, el dueño de la compu, con una sola sesión para todas las conexiones.
        const campus = localCampus();
        if (!campus) throw new Error("Todavía no elegiste tu campus: corré `mcp-uni-arg login`.");
        const platforms = {
            aula: campus.aula && new LocalSession(campus.aula),
            guarani: campus.guarani && new LocalGuaraniSession(campus.guarani),
        };
        serveStdio(() => createServer(platforms, { local: true }), { onerror: (e) => logger.error(e.message) });
        logger.info(`Servidor MCP iniciado en STDIO (${campus.universidad} · ${campus.nombre})`);
    }
}

main().catch((e) => {
    logger.error((e as Error).message);
    process.exit(1);
});
