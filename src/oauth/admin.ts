import { timingSafeEqual } from "node:crypto";
import express, { type Express, type RequestHandler } from "express";
import { AULA_PLATFORM } from "../aula-virtual/client/hosted-session.js";
import type { SessionStore } from "../shared/store/session-store.js";

/**
 * API para que otro servicio de quien hostea (por ejemplo un panel de cuenta) liste y desconecte las
 * apps de un usuario. Solo se monta con MCP_UNI_ADMIN_SECRET, que se manda como `Authorization:
 * Bearer`. Los usuarios se buscan por su email institucional.
 */
export function mountAdmin(app: Express, store: SessionStore, secret: string) {
    const json = express.json({ limit: "4kb" });

    const requireSecret: RequestHandler = (req, res, next) => {
        const got = Buffer.from(req.headers.authorization ?? "");
        const want = Buffer.from(`Bearer ${secret}`);
        if (got.length === want.length && timingSafeEqual(got, want)) return next();
        res.status(401).json({ error: "No autorizado." });
    };

    /** `{ email }` → el usuario, la última renovación de su sesión del aula y sus apps conectadas. */
    app.post("/admin/clientes", requireSecret, json, async (req, res) => {
        const email = typeof req.body?.email === "string" ? req.body.email : "";
        const user = email ? await store.findUserByEmail(email) : null;
        if (!user) return void res.json({ clientes: [] });

        const [clients, aulaAt] = await Promise.all([
            store.listConnectedClients(user.id),
            store.sessionUpdatedAt(user.id, AULA_PLATFORM),
        ]);
        res.json({
            usuario: user.username,
            campus: user.campus,
            sesionAula: aulaAt ? new Date(aulaAt * 1000).toISOString() : undefined,
            clientes: clients.map((c) => ({
                id: c.clientId,
                nombre: c.clientName ?? (c.clientId === "local" ? "Token de mcp-uni-arg login" : "App sin nombre"),
                ultimoUso: new Date(c.lastTokenAt * 1000).toISOString(),
            })),
        });
    });

    /** `{ email, cliente }` → elimina los tokens de esa app, que deberá conectarse de nuevo. */
    app.post("/admin/clientes/revocar", requireSecret, json, async (req, res) => {
        const email = typeof req.body?.email === "string" ? req.body.email : "";
        const clientId = typeof req.body?.cliente === "string" ? req.body.cliente : "";
        const user = email ? await store.findUserByEmail(email) : null;
        if (!user || !clientId) return void res.status(404).json({ error: "No existe ese usuario o esa app." });
        await store.revokeClient(user.id, clientId);
        res.json({ revocado: true });
    });
}
