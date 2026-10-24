import type { ServerContext } from "@modelcontextprotocol/server";

/** Cuánto lleva una tool que recorre varios cursos: el cliente lo muestra mientras espera. */
export type Progress = (done: number, total: number, message: string) => void;

/**
 * Espera tareas en paralelo y avisa cada vez que termina una. `done` arranca en `start`, para que una tool
 * con varias etapas sume sobre lo que ya avisó: MCP pide que el progreso solo crezca.
 */
export async function tracked<T>(
    tasks: Promise<T>[],
    progress: Progress | undefined,
    message: string,
    { start = 0, total = start + tasks.length }: { start?: number; total?: number } = {},
): Promise<T[]> {
    let done = start;
    return Promise.all(
        tasks.map((task) =>
            task.finally(() => {
                done++;
                progress?.(done, total, message);
            }),
        ),
    );
}

/** El aviso de progreso de MCP, si el cliente lo pidió con un `progressToken`. */
export function progressOf(ctx: ServerContext): Progress | undefined {
    const progressToken = ctx.mcpReq._meta?.progressToken;
    if (progressToken === undefined) return undefined;
    return (progress, total, message) => {
        ctx.mcpReq
            .notify({ method: "notifications/progress", params: { progressToken, progress, total, message } })
            .catch(() => {}); // Un aviso que no llega no tiene que cortar la respuesta.
    };
}
