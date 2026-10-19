/**
 * Direcciones para navegar el aula: un path que el modelo recibe en una respuesta y devuelve igual para
 * entrar. El servidor no guarda estado: la dirección alcanza, y el padre sale de recortar el texto (así
 * funciona "volver").
 */
export type Address =
    | { level: "root" }
    | { level: "course"; courseId: number }
    | { level: "module"; courseId: number; cmid: number }
    | { level: "discussion"; courseId: number; cmid: number; discussionId: number };

export const ROOT = "/";
export const courseAddr = (courseId: number) => `/curso/${courseId}`;
export const moduleAddr = (courseId: number, cmid: number) => `/curso/${courseId}/mod/${cmid}`;
export const discussionAddr = (courseId: number, cmid: number, discussionId: number) =>
    `/curso/${courseId}/mod/${cmid}/disc/${discussionId}`;

const FORMATS = [
    "/",
    "/curso/{courseId}",
    "/curso/{courseId}/mod/{cmid}",
    "/curso/{courseId}/mod/{cmid}/disc/{discussionId}",
].join(", ");

const PATTERN = /^\/curso\/(\d+)(?:\/mod\/(\d+)(?:\/disc\/(\d+))?)?$/;

export function parseAddress(raw: string): Address {
    const path = raw.trim().replace(/\/+$/, "") || "/";
    if (path === "/") return { level: "root" };

    const m = PATTERN.exec(path);
    if (!m) throw new Error(`Dirección inválida: "${raw}". Formatos válidos: ${FORMATS}`);

    const [, course, cmid, disc] = m;
    const courseId = Number(course);
    if (!cmid) return { level: "course", courseId };
    if (!disc) return { level: "module", courseId, cmid: Number(cmid) };
    return { level: "discussion", courseId, cmid: Number(cmid), discussionId: Number(disc) };
}

/** Dirección como texto, la forma que ve el modelo. */
export function formatAddress(address: Address): string {
    switch (address.level) {
        case "root":
            return ROOT;
        case "course":
            return courseAddr(address.courseId);
        case "module":
            return moduleAddr(address.courseId, address.cmid);
        case "discussion":
            return discussionAddr(address.courseId, address.cmid, address.discussionId);
    }
}

/** Dirección del nivel de arriba; null en la raíz. */
export function parentOf(address: Address): string | null {
    switch (address.level) {
        case "root":
            return null;
        case "course":
            return ROOT;
        case "module":
            return courseAddr(address.courseId);
        case "discussion":
            return moduleAddr(address.courseId, address.cmid);
    }
}
