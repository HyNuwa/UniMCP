/** Deja correr hasta `max` tareas a la vez; las demás esperan su turno en orden. */
export class Limiter {
    private active = 0;
    private readonly waiting: (() => void)[] = [];

    constructor(readonly max: number) {}

    async run<T>(task: () => Promise<T>): Promise<T> {
        if (this.active < this.max) this.active++;
        else await new Promise<void>((resolve) => this.waiting.push(resolve));
        try {
            return await task();
        } finally {
            // El lugar pasa directo al siguiente, sin liberarlo.
            const next = this.waiting.shift();
            if (next) next();
            else this.active--;
        }
    }
}
