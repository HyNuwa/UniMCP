// Proyección ortográfica centrada en Argentina. La usan scripts/map.mts para dibujar los puntos y el
// mapa de la página para ubicar los pines, así que los dos siempre coinciden.

const D = Math.PI / 180;
/** Centro de la proyección, en grados. Las dos vistas lo comparten: el zoom es un scale desde el medio. */
export const CENTER = { lon: -64, lat: -38 };
/** Lado del lienzo, en px del SVG. */
export const SIZE = 920;
/** Radio del globo en la vista del mundo y en la de Argentina, en px del SVG. */
export const RADIUS = { mundo: 440, argentina: 1440 };
export const ZOOM = RADIUS.argentina / RADIUS.mundo;

const L0 = CENTER.lon * D;
const P0 = CENTER.lat * D;

/** Grados → px del lienzo; null si el punto queda del otro lado del globo. */
export function project(r: number, lon: number, lat: number): [number, number] | null {
    const l = lon * D;
    const p = lat * D;
    const cosc = Math.sin(P0) * Math.sin(p) + Math.cos(P0) * Math.cos(p) * Math.cos(l - L0);
    if (cosc < 0) return null;
    const x = r * Math.cos(p) * Math.sin(l - L0);
    const y = r * (Math.cos(P0) * Math.sin(p) - Math.sin(P0) * Math.cos(p) * Math.cos(l - L0));
    return [SIZE / 2 + x, SIZE / 2 - y];
}

/** Px del lienzo → grados; null fuera del disco. */
export function unproject(r: number, px: number, py: number): [number, number] | null {
    const x = px - SIZE / 2;
    const y = SIZE / 2 - py;
    const rho = Math.hypot(x, y);
    if (rho > r) return null;
    if (rho === 0) return [CENTER.lon, CENTER.lat];
    const c = Math.asin(rho / r);
    const lat = Math.asin(Math.cos(c) * Math.sin(P0) + (y * Math.sin(c) * Math.cos(P0)) / rho);
    const lon = L0 + Math.atan2(x * Math.sin(c), rho * Math.cos(c) * Math.cos(P0) - y * Math.sin(c) * Math.sin(P0));
    return [(((lon / D) + 540) % 360) - 180, lat / D];
}

/** Posición en % del lienzo, para ubicar un pin con `left`/`top`. */
export function percent(r: number, lon: number, lat: number): { x: string; y: string } {
    const p = project(r, lon, lat);
    if (!p) throw new Error(`(${lon}, ${lat}) no se ve desde el centro del mapa.`);
    return { x: ((p[0] / SIZE) * 100).toFixed(2), y: ((p[1] / SIZE) * 100).toFixed(2) };
}
