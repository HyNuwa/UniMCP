import express, { type Request as ExpressRequest, type RequestHandler, type Response as ExpressResponse } from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import {
    bearerAuthChallengeResponse,
    createMcpHandler,
    OAuthError,
    OAuthErrorCode,
    verifyBearerToken,
    type AuthInfo,
    type McpServerFactory,
    type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node";
import type { AccessPolicy } from "./oauth/access.js";
import { mountAdmin } from "./oauth/admin.js";
import type { RedirectAllowlist } from "./oauth/redirects.js";
import { cors, mountOAuth } from "./oauth/server.js";
import { logger } from "./shared/logger.js";
import type { SessionStore } from "./shared/store/session-store.js";
import { escapeHtml, page } from "./shared/html-pages.js";
import { MAX_UPLOAD_BYTES, formatSize, type UploadInbox, type UploadLimits } from "./shared/uploads.js";

type Guard = (req: IncomingMessage, res: ServerResponse) => boolean;
const asMiddleware = (guard: Guard): RequestHandler => (req, res, next) => {
    if (guard(req, res)) next();
};

/**
 * El SDK no acepta tokens sin vencimiento, así que al token fijo del modo local se le da uno muy
 * lejano: 1/1/3000, en segundos desde epoch.
 */
const NEVER = 32_503_680_000;

/** Id en el store del dueño del token, que viaja en `extra.userId`. */
export function userIdOf(authInfo: AuthInfo | undefined): number {
    const userId = authInfo?.extra?.userId;
    if (typeof userId !== "number") throw new Error("Request sin usuario autenticado.");
    return userId;
}

/** Campus del dueño del token, en `extra.campus`; define con qué aula se habla. */
export function campusOf(authInfo: AuthInfo | undefined): string {
    const campus = authInfo?.extra?.campus;
    if (typeof campus !== "string") throw new Error("Request sin campus del usuario.");
    return campus;
}

/** Valida el token contra el store: el MCP solo deja pasar access tokens vigentes. */
function storeVerifier(store: SessionStore): OAuthTokenVerifier {
    return {
        async verifyAccessToken(token) {
            const found = await store.findToken(token, "access");
            if (!found) throw new OAuthError(OAuthErrorCode.InvalidToken, "Token desconocido, vencido o revocado.");
            const user = await store.findUser(found.userId);
            if (!user) throw new OAuthError(OAuthErrorCode.InvalidToken, "El usuario del token ya no existe.");
            return {
                token,
                clientId: found.clientId ?? "desconocido",
                scopes: [],
                expiresAt: found.expiresAt ?? NEVER,
                extra: { userId: user.id, campus: user.campus },
            };
        },
    };
}

const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

/** Dirección donde escucha el servidor y, si está publicado, la URL con la que lo ven los clientes. */
export interface HttpOptions {
    host: string;
    port: number;
    /** Sin barra al final, por ejemplo `https://mcp.tu-dominio.com`. */
    publicUrl?: string;
    /** Política de quién puede entrar por OAuth. */
    access: AccessPolicy;
    /** Destinos permitidos para el navegador al terminar el login OAuth. */
    redirects: RedirectAllowlist;
    /** Si está, se habilita la API de /admin (ver `mountAdmin`). */
    adminSecret?: string;
}

/**
 * El factory recibe en `ctx.authInfo` el token validado con su usuario y arma la sesión a partir de
 * eso.
 */
export function startHttpServer(factory: McpServerFactory, options: HttpOptions, store: SessionStore, inbox: UploadInbox) {
    const { host, port, publicUrl, access, redirects, adminSecret } = options;
    const handler = createMcpHandler(factory, { onerror: (e) => logger.error(e.message) });
    const verifier = storeVerifier(store);
    const app = express();
    // Si hay un reverse proxy en la misma máquina, la IP real del cliente (la que usa el rate limit)
    // llega en X-Forwarded-For.
    app.set("trust proxy", "loopback");
    app.disable("x-powered-by");
    app.use(securityHeaders(publicUrl?.startsWith("https://") ?? false));

    // Defensa contra DNS rebinding: solo pasan los hosts locales y el de la URL pública.
    const allowed = publicUrl ? [...LOOPBACK, new URL(publicUrl).hostname] : LOOPBACK;
    if (!publicUrl && !LOOPBACK.includes(host)) {
        logger.warn(`Escuchando en ${host} sin MCP_UNI_PUBLIC_URL: se rechazan los requests que no lleguen como localhost.`);
    }
    app.use(asMiddleware(hostHeaderValidation(allowed)));
    // Origin se controla donde un navegador ajeno no debería llegar; los endpoints de OAuth tienen CORS
    // abierto.
    const sameOrigin = asMiddleware(originValidation(allowed));

    const resourceMetadataUrl = mountOAuth(app, {
        issuer: publicUrl ?? `http://127.0.0.1:${port}`,
        store,
        access,
        sameOrigin,
        redirects,
    });

    if (adminSecret) mountAdmin(app, store, adminSecret);

    const requireToken: RequestHandler = async (req, res, next) => {
        try {
            // toNodeHandler entrega `req.auth` al handler como `authInfo`.
            (req as { auth?: AuthInfo }).auth = await verifyBearerToken(req.headers.authorization, { verifier });
            next();
        } catch (e) {
            // El 401 indica dónde está la metadata, que es por donde el cliente empieza el OAuth.
            const challenge = bearerAuthChallengeResponse(e, { resourceMetadataUrl });
            res.status(challenge.status);
            challenge.headers.forEach((value, name) => res.setHeader(name, value));
            res.send(await challenge.text());
        }
    };

    // Publicado, /mcp acepta cualquier origen porque se autentica con el bearer y el navegador nunca lo
    // agrega por su cuenta (no hay cookies): una página ajena no puede usarlo haciéndose pasar por
    // nadie. Algunos clientes, como Grok, lo llaman desde su web. En local se mantiene el chequeo de
    // Origin por el DNS rebinding.
    const mcpOrigin = publicUrl ? cors : sameOrigin;
    app.options("/mcp", mcpOrigin, (_req, res) => void res.sendStatus(204));
    // Sin express.json(): el handler se encarga de leer el body.
    app.all("/mcp", mcpOrigin, requireToken, toNodeHandler(handler));
    // Sin bearer: el secreto es el id del link, y lo abre un navegador o un `curl` que no tienen token.
    app.get("/subir/:id", sameOrigin, (req, res) => {
        const upload = inbox.get(String(req.params.id));
        if (!upload) return void res.status(404).type("html").send(page("Link vencido", EXPIRED));
        if (upload.files) return void res.status(409).type("html").send(page("Link ya usado", USED));
        res.type("html").send(page(upload.title, uploadForm(upload.limits)));
    });
    app.post("/subir/:id", sameOrigin, (req, res) => receiveUpload(inbox, req, res));

    app.listen(port, host, () => {
        logger.info(`Servidor MCP escuchando en http://${host}:${port}/mcp`);
        if (publicUrl) logger.info(`Publicado en ${publicUrl}/mcp`);
    });
}

/**
 * Recibe el multipart del formulario o de `curl -F archivos=@...`. Responde HTML al navegador y JSON a
 * cualquier otro.
 */
async function receiveUpload(inbox: UploadInbox, req: ExpressRequest, res: ExpressResponse): Promise<void> {
    const browser = req.accepts(["json", "html"]) === "html";
    const fail = (status: number, message: string) =>
        browser
            ? res.status(status).type("html").send(page("No se pudo subir", `<p>${escapeHtml(message)}</p>`))
            : res.status(status).json({ error: message });

    const id = String(req.params.id);
    const upload = inbox.get(id);
    if (!upload) return void fail(404, "El link de subida venció o no existe.");
    if (upload.files) return void fail(409, "Este link ya se usó. Pedile al agente uno nuevo.");
    const tooBig = `La subida pasa el máximo de ${formatSize(MAX_UPLOAD_BYTES)}.`;
    if (Number(req.headers["content-length"]) > MAX_UPLOAD_BYTES) return void fail(413, tooBig);

    const body = limitBytes(Readable.toWeb(req) as ReadableStream<Uint8Array>, MAX_UPLOAD_BYTES);
    try {
        // Request web: arma el multipart sin agregar dependencias.
        const request = new Request(`http://localhost${req.url}`, {
            method: "POST",
            headers: req.headers as Record<string, string>,
            body: body.stream,
            duplex: "half",
        } as RequestInit);
        const form = await request.formData();
        const files = await Promise.all(
            form
                .getAll("archivos")
                .filter((v): v is File => typeof v !== "string" && v.size > 0)
                .map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
        );
        inbox.receive(id, files);
        const received = files.map((f) => ({ nombre: f.name, tamanio: f.bytes.length }));
        if (browser) {
            const list = received.map((f) => `<li>${escapeHtml(f.nombre)} (${formatSize(f.tamanio)})</li>`).join("");
            res.type("html").send(page("Listo", `<ul>${list}</ul><p>Volvé al chat y avisá que ya los subiste.</p>`));
        } else {
            res.json({ recibidos: received });
        }
    } catch (e) {
        if (body.exceeded()) {
            fail(413, tooBig);
            req.destroy();
        } else {
            fail(400, (e as Error).message);
        }
    }
}

function limitBytes(source: ReadableStream<Uint8Array>, maxBytes: number) {
    let total = 0;
    const stream = source.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                total += chunk.length;
                if (total > maxBytes) controller.error(new Error("La subida es demasiado grande."));
                else controller.enqueue(chunk);
            },
        }),
    );
    return { stream, exceeded: () => total > maxBytes };
}

function securityHeaders(https: boolean): RequestHandler {
    return (_req, res, next) => {
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
        );
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("X-Content-Type-Options", "nosniff");
        // `same-origin` en vez de `no-referrer`: con `no-referrer` el navegador manda `Origin: null` en
        // los POST de formularios y el chequeo de Origin rechaza el login.
        res.setHeader("Referrer-Policy", "same-origin");
        // Un año expresado en segundos.
        if (https) res.setHeader("Strict-Transport-Security", "max-age=31536000");
        next();
    };
}

const EXPIRED = "<p>Este link de subida venció o ya no existe. Pedile al agente uno nuevo.</p>";
const USED = "<p>Ya se subieron archivos a este link y no se pueden cambiar. Si te equivocaste, pedile al agente uno nuevo.</p>";

function uploadForm(limits: UploadLimits): string {
    const rules = [
        limits.maxFiles ? `hasta ${limits.maxFiles} archivo(s)` : "",
        `hasta ${formatSize(limits.maxBytes)} cada uno`,
        limits.extensions?.length ? `tipos: ${limits.extensions.join(", ")}` : "",
    ].filter(Boolean);
    const accept = limits.extensions?.length ? ` accept="${escapeHtml(limits.extensions.join(","))}"` : "";
    return (
        `<p>Elegí los archivos para la entrega (${escapeHtml(rules.join(", "))}).</p>` +
        `<form method="post" enctype="multipart/form-data">` +
        `<input type="file" name="archivos" multiple required${accept}>` +
        `<button type="submit">Subir</button></form>` +
        "<p class=nota>Subirlos no entrega la tarea: después el agente te confirma y la entrega.</p>"
    );
}
