import { McpServer } from "@modelcontextprotocol/server";
import type { AulaSession } from "./aula-virtual/client/session.js";
import { registerAulaVirtualTools } from "./aula-virtual/tools.js";
import type { GuaraniSession } from "./guarani/client/session.js";
import { registerGuaraniTools } from "./guarani/tools.js";
import type { FileSource } from "./shared/uploads.js";

/** Plataformas que tiene el campus del usuario: no todos tienen aula y Guaraní. */
export interface Platforms {
    aula?: AulaSession;
    guarani?: GuaraniSession;
}

/**
 * Crea un servidor MCP para un usuario; STDIO lo crea por conexión y HTTP por request.
 * `files`: el origen de los archivos que el usuario sube a una plataforma.
 */
export function createServer({ aula, guarani }: Platforms, files: FileSource): McpServer {
    const server = new McpServer({
        name: "mcp-uni-arg",
        version: "0.1.0",
    });

    if (aula) registerAulaVirtualTools(server, aula, files);
    if (guarani) registerGuaraniTools(server, guarani);

    return server;
}
