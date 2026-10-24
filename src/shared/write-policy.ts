/**
 * Qué tools que escriben existen. Las instrucciones y las descripciones le piden al modelo que escriba
 * solo por pedido del usuario, pero eso depende de que obedezca; esto lo fija quien opera el servidor,
 * y una tool que no se registra no la puede pedir ningún texto del aula.
 */
export type WritePolicy = "all" | ReadonlySet<string>;

/**
 * `UNIMCP_WRITE_TOOLS`: `all`, `none` o nombres separados por comas o espacios. Sin definir, todas en
 * STDIO (el usuario es el dueño de la compu) y ninguna en HTTP.
 */
export function writePolicyFromEnv(local: boolean, raw = process.env.UNIMCP_WRITE_TOOLS): WritePolicy {
    const names = raw?.split(/[\s,]+/).filter(Boolean);
    if (!names?.length) return local ? "all" : new Set();
    if (names.length === 1 && names[0] === "all") return "all";
    if (names.length === 1 && names[0] === "none") return new Set();
    if (names.includes("all") || names.includes("none")) {
        throw new Error("`UNIMCP_WRITE_TOOLS` lleva `all`, `none` o una lista de tools, no las dos cosas.");
    }
    return new Set(names);
}

/** Una tool escribe salvo que declare lo contrario: sin anotaciones, queda afuera. */
export const writes = (annotations?: { readOnlyHint?: boolean }) => annotations?.readOnlyHint !== true;
