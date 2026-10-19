/** Una parte de una página de G3W, tal como llega en `kernel.renderer.on_arrival`. */
export interface Pagelet {
    /** La operación de la página, ej. `historia_academica`; la comparten todas sus partes. */
    op: string;
    /** El id de la parte, ej. `login`, `menu`. */
    id: string;
    content: string;
}

export interface G3wPage {
    /** Dónde terminó el request, después de las redirecciones. */
    url: string;
    op: string | null;
    pagelets: Pagelet[];
    /** El HTML de la página sin los scripts: en UNJu el menú y el selector de carrera vienen acá, no en una parte. */
    shell: string;
}
