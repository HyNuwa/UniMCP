// Dibuja los dos mapas de puntos de la sección "Dónde anda" en public/map/: el globo y Argentina con sus
// provincias. Las provincias con campus salen de src/data/places.ts, así que una ciudad nueva se pinta sola.
// Los contornos se bajan una vez a .cache/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CITIES } from "../src/data/places.js";
import { RADIUS, SIZE, project, unproject } from "../src/lib/projection.js";

const SOURCES = {
    // Natural Earth simplificado, por país (id ISO3).
    "world.json": "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json",
    // geoBoundaries ARG ADM1 (CC BY 4.0). Le falta Entre Ríos como polígono: sus bordes los dibujan las vecinas.
    "provinces.json":
        "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/ARG/ADM1/geoBoundaries-ARG-ADM1_simplified.geojson",
};

type Ring = number[][];
type Feature = { id?: string; properties: Record<string, string>; geometry: { type: string; coordinates: unknown } };
type Shape = { key: string; polygons: Ring[][]; bbox: number[] };

const cache = new URL("../.cache/", import.meta.url);
const out = new URL("../public/map/", import.meta.url);
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

async function load(name: keyof typeof SOURCES): Promise<Feature[]> {
    const file = new URL(name, cache);
    if (!existsSync(file)) {
        const res = await fetch(SOURCES[name]);
        if (!res.ok) throw new Error(`No pude bajar ${SOURCES[name]}: ${res.status}`);
        writeFileSync(file, await res.text());
    }
    return JSON.parse(readFileSync(file, "utf8")).features;
}

function shapes(features: Feature[], key: (f: Feature) => string): Shape[] {
    return features.map((f) => {
        const polygons = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
        const bbox = [180, 90, -180, -90];
        for (const p of polygons)
            for (const [x, y] of p[0]) {
                bbox[0] = Math.min(bbox[0], x);
                bbox[1] = Math.min(bbox[1], y);
                bbox[2] = Math.max(bbox[2], x);
                bbox[3] = Math.max(bbox[3], y);
            }
        return { key: key(f), polygons, bbox };
    });
}

function inRing(x: number, y: number, ring: Ring): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

function find(list: Shape[], lon: number, lat: number): string | null {
    for (const s of list) {
        if (lon < s.bbox[0] || lon > s.bbox[2] || lat < s.bbox[1] || lat > s.bbox[3]) continue;
        for (const p of s.polygons) if (inRing(lon, lat, p[0]) && !p.slice(1).some((h) => inRing(lon, lat, h))) return s.key;
    }
    return null;
}

/** Un punto por celda de la grilla, agrupados por color; cada grupo es un solo path con trazos de largo 0. */
function dots(r: number, step: number, dot: number, colors: Record<string, string>, classify: (lon: number, lat: number) => string | null): string {
    const groups: Record<string, string[]> = {};
    for (let y = step / 2; y < SIZE; y += step)
        for (let x = step / 2; x < SIZE; x += step) {
            const ll = unproject(r, x, y);
            const k = ll && classify(ll[0], ll[1]);
            if (k) (groups[k] ??= []).push(`M${x.toFixed(1)} ${y.toFixed(1)}h0`);
        }
    return Object.entries(colors)
        .filter(([k]) => groups[k])
        .map(([k, c]) => `<path d="${groups[k].join("")}" stroke="${c}" stroke-width="${dot}" stroke-linecap="round" fill="none"/>`)
        .join("");
}

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`;

const countries = shapes(await load("world.json"), (f) => f.id ?? "");
const provinces = shapes(await load("provinces.json"), (f) => f.properties.shapeName);
/** Malvinas se pinta como Argentina. */
const ARGENTINA = new Set(["ARG", "FLK"]);
const withCampus = new Set<string>(Object.values(CITIES).map((c) => c.province));

const world = svg(
    `<circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${RADIUS.mundo}" fill="#1C1814" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>` +
        dots(RADIUS.mundo, 9, 5.4, { land: "rgba(243,242,239,.30)", arg: "#FF7A59" }, (lon, lat) => {
            const c = find(countries, lon, lat);
            return c ? (ARGENTINA.has(c) ? "arg" : "land") : null;
        }),
);

const border = (ring: Ring) => {
    let d = "";
    let pen = false;
    for (const [lon, lat] of ring) {
        const p = project(RADIUS.argentina, lon, lat);
        if (!p) {
            pen = false;
            continue;
        }
        d += `${pen ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
        pen = true;
    }
    return d + "Z";
};
const argentina = svg(
    dots(RADIUS.argentina, 10, 6.8, { land: "rgba(243,242,239,.16)", arg: "rgba(243,242,239,.62)", campus: "#FF7A59" }, (lon, lat) => {
        const c = find(countries, lon, lat);
        if (!c) return null;
        if (!ARGENTINA.has(c)) return "land";
        const p = find(provinces, lon, lat);
        return p && withCampus.has(p) ? "campus" : "arg";
    }) +
        `<path d="${provinces.flatMap((p) => p.polygons.map((poly) => border(poly[0]))).join("")}" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="1.4" stroke-linejoin="round"/>`,
);

const missing = [...withCampus].filter((p) => !provinces.some((s) => s.key === p));
if (missing.length) throw new Error(`Estas provincias de places.ts no están en geoBoundaries: ${missing.join(", ")}`);

writeFileSync(new URL("world.svg", out), world);
writeFileSync(new URL("argentina.svg", out), argentina);
console.log(`map: world.svg ${(world.length / 1024).toFixed(0)} KB, argentina.svg ${(argentina.length / 1024).toFixed(0)} KB`);
