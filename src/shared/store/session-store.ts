/**
 * Almacén del modo HTTP: usuarios, sus tokens y su sesión en cada plataforma. El servidor MCP lo lee (y
 * escribe la sesión al renovarla); los usuarios y tokens los crea otro proceso, que es el login OAuth
 * del modo hosteado o `mcp-uni-arg login --http` en local.
 */
export interface SessionStore {
    /**
     * Id del usuario con ese nombre en ese campus, creándolo si no existe; si se pasa `email`, lo
     * actualiza. Un mismo nombre en dos campus son dos usuarios distintos, porque cada Moodle tiene los
     * suyos.
     */
    findOrCreateUser(campus: string, username: string, email?: string): Promise<number>;

    findUser(userId: number): Promise<StoredUser | null>;

    findUserByEmail(email: string): Promise<StoredUser | null>;

    /**
     * Emite un token para el usuario y devuelve el valor en claro, que se muestra una sola vez: en la
     * base solo queda el hash. Sin `ttlSeconds` no vence (es el token fijo del modo local).
     */
    issueToken(userId: number, options: { kind: TokenKind; clientId?: string; ttlSeconds?: number }): Promise<string>;

    /** Devuelve el token si es de ese tipo y sigue vigente; si no, null. */
    findToken(token: string, kind: TokenKind): Promise<IssuedToken | null>;

    revokeToken(token: string): Promise<void>;

    /** Sesión del usuario en una plataforma, tal como se guardó; el formato lo define cada plataforma. */
    loadSession(userId: number, platform: string): Promise<string | null>;

    saveSession(userId: number, platform: string, data: string): Promise<void>;

    /** Última vez que se guardó la sesión, en segundos desde epoch; null si nunca. */
    sessionUpdatedAt(userId: number, platform: string): Promise<number | null>;

    /** Clientes OAuth dados de alta por registro dinámico (RFC 7591). */
    saveClient(client: RegisteredClient): Promise<void>;

    findClient(clientId: string): Promise<RegisteredClient | null>;

    /** Clientes con algún token vigente del usuario, es decir, sus apps conectadas. */
    listConnectedClients(userId: number): Promise<ConnectedClient[]>;

    /** Elimina todos los tokens del usuario para ese cliente, que queda desconectado. */
    revokeClient(userId: number, clientId: string): Promise<void>;
}

export interface ConnectedClient {
    clientId: string;
    /** Nombre que mandó la app al registrarse; null en el token fijo de `mcp-uni-arg login --http`. */
    clientName: string | null;
    /** Emisión de su token más reciente, en segundos desde epoch (los refresh rotan al usarse). */
    lastTokenAt: number;
}

export interface StoredUser {
    id: number;
    /** Id del campus en el registro (`shared/campus.ts`), por ejemplo `unju`. */
    campus: string;
    /** Usuario del aula de ese campus. */
    username: string;
    /** Email institucional, el que decide el acceso; null en usuarios creados antes de guardarlo. */
    email: string | null;
}

/** Cliente público: no tiene secreto y se autentica con PKCE. */
export interface RegisteredClient {
    clientId: string;
    clientName: string | null;
    redirectUris: string[];
}

/** `access` acompaña cada request al MCP; `refresh` solo sirve para conseguir un `access` nuevo. */
export type TokenKind = "access" | "refresh";

export interface IssuedToken {
    userId: number;
    clientId: string | null;
    /** Segundos desde epoch; null si no vence. */
    expiresAt: number | null;
}
