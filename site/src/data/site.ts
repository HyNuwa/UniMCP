// Cruza lo que sale del código (generated.json, de scripts/data.mts) con lo que sabe la web (places.ts, copy.ts).
import generated from "./generated.json";
import { CAMPUS_CITY, CITIES, PROVINCE_PIN, TESTED_BY, UNIVERSITY_NAME, type CityId } from "./places";
import { CONFIRMED, TOOL_COPY } from "./copy";
import { RADIUS, percent } from "../lib/projection";

export const PKG = generated.paquete;
export const VERSION = generated.version;
export const REPO = "https://github.com/HyNuwa/UniMCP";
/** Descarga directa de la extensión del último release: release.yml la sube también con este nombre fijo. */
export const MCPB_URL = `${REPO}/releases/latest/download/unimcp.mcpb`;
/** El hilo donde cada uno pega su `unimcp check` para aparecer en el mapa. */
export const THREAD = generated.hilo;
const probaron: Record<string, string[]> = generated.probaron;

const unplaced = generated.campus.filter((c) => !CAMPUS_CITY[c.id]).map((c) => c.id);
if (unplaced.length) throw new Error(`Falta la ciudad de estos campus en src/data/places.ts: ${unplaced.join(", ")}`);
const misplaced = generated.campus.filter((c) => CITIES[CAMPUS_CITY[c.id]].province !== c.provincia).map((c) => c.id);
if (misplaced.length) throw new Error(`La ciudad de estos campus está en otra provincia que la de campus.ts: ${misplaced.join(", ")}`);

/** Minúsculas y sin tildes: el buscador de la lista compara así. */
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Universidades en el orden de campus.ts, con sus campus y sus ciudades. */
export const UNIVERSITIES = [...new Set(generated.campus.map((c) => c.universidad))].map((sigla) => {
    const campus = generated.campus.filter((c) => c.universidad === sigla);
    const cities = [...new Set(campus.map((c) => CAMPUS_CITY[c.id]))] as CityId[];
    const name = UNIVERSITY_NAME[sigla];
    if (!name) throw new Error(`Falta el nombre de ${sigla} en UNIVERSITY_NAME (src/data/places.ts).`);
    return {
        id: sigla,
        name,
        cities,
        cityLabel: cities.map((c) => CITIES[c].name).join(" · "),
        campus:
            campus.length === 1 && campus[0].nombre === name
                ? "Toda la universidad, en un solo campus."
                : campus.map((c) => c.nombre + (c.sso ? " (con SSO)" : "")).join(" · "),
        provinces: [...new Set(campus.map((c) => c.provincia))],
        /**
         * Lo que encuentra el buscador en cada provincia: sigla, nombre y los campus y ciudades de ahí. Así
         * "córdoba" muestra la UTN en Córdoba, y no en todas las provincias donde está.
         */
        search: Object.fromEntries(
            [...new Set(campus.map((c) => c.provincia))].map((province) => {
                const here = campus.filter((c) => c.provincia === province);
                const places = [...new Set(here.map((c) => CITIES[CAMPUS_CITY[c.id]].name))];
                return [province, fold([sigla, name, province, ...here.map((c) => c.nombre), ...places].join(" "))];
            }),
        ) as Record<string, string>,
        aula: campus.some((c) => c.aula),
        guarani: campus.some((c) => c.guarani),
        testedBy: TESTED_BY[sigla],
        /** Quienes pegaron su `unimcp check` en el hilo con un campus de esta universidad, sin repetir al de testedBy. */
        testers: [...new Set(campus.flatMap((c) => probaron[c.id] ?? []))].filter((login) => login !== TESTED_BY[sigla]),
    };
});

/**
 * Las provincias con campus, de norte a sur: un pin cada una, en su centro (PROVINCE_PIN), con cuántas
 * universidades tiene. Con decenas de universidades, un pin por provincia no se pisa como las siglas.
 */
export const PROVINCES = [...new Set(generated.campus.map((c) => c.provincia))]
    .map((name) => {
        const pin = PROVINCE_PIN[name];
        if (!pin) throw new Error(`Falta el pin de ${name} en PROVINCE_PIN (src/data/places.ts).`);
        const unis = UNIVERSITIES.filter((u) => u.provinces.includes(name)).map((u) => u.id);
        return { name, unis, ...pin, ...percent(RADIUS.argentina, pin.lon, pin.lat) };
    })
    .sort((a, b) => b.lat - a.lat);

/** El pin del globo: el promedio de las provincias. */
export const WORLD_PIN = percent(
    RADIUS.mundo,
    PROVINCES.reduce((s, p) => s + p.lon, 0) / PROVINCES.length,
    PROVINCES.reduce((s, p) => s + p.lat, 0) / PROVINCES.length,
);

const READ_COLORS = ["#9AD3FF", "#7CC4FF", "#5DB2FF", "#4AA2F2", "#5CC6E4", "#45B6CF", "#3FA7BA", "#5ACDB6", "#44BC9C"];
const GUARANI_COLORS = ["#C7B6FF", "#A88BFF"];
const WRITE_COLORS = ["#FFC85C", "#FFB347", "#FF9D3D", "#FF8A4C", "#FF7A59", "#F56649", "#E9533F", "#D9433A"];
const pick = (colors: string[], i: number) => colors[Math.min(i, colors.length - 1)];

/** En el orden de TOOL_COPY; las que no tienen texto, al final. */
const ORDER = Object.keys(TOOL_COPY);
const rank = (name: string) => (ORDER.includes(name) ? ORDER.indexOf(name) : ORDER.length);
const sorted = [...generated.tools].sort((a, b) => rank(a.name) - rank(b.name));
const reads = sorted.filter((t) => t.plataforma === "aula" && !t.escribe);
const guarani = sorted.filter((t) => t.plataforma === "guarani");
const writes = sorted.filter((t) => t.escribe && t.plataforma === "aula");
const shown = (t: (typeof generated.tools)[number], color: string) => ({
    name: t.name,
    text: TOOL_COPY[t.name] ?? t.descripcion,
    color,
    kind: !t.escribe ? "lee" : CONFIRMED.has(t.name) ? "confirmás" : "escribe",
});

/** Las tools en el orden de la barra: leen el aula, Guaraní, escriben. */
export const TOOLS = [
    ...reads.map((t, i) => shown(t, pick(READ_COLORS, i))),
    ...guarani.map((t, i) => shown(t, pick(GUARANI_COLORS, i))),
    ...writes.map((t, i) => shown(t, pick(WRITE_COLORS, i))),
];
export const READ_COUNT = reads.length + guarani.length;
export const WRITE_COUNT = writes.length;

export const STATS = {
    tools: generated.tools.length,
    campus: generated.campus.length,
    universidades: UNIVERSITIES.length,
    provincias: PROVINCES.length,
};


/** Un archivo de public/, con la base del sitio (en GitHub Pages es /UniMCP/). */
export const asset = (path: string) => import.meta.env.BASE_URL.replace(/\/?$/, "/") + path;
