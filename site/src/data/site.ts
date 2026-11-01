// Cruza lo que sale del código (generated.json, de scripts/data.mts) con lo que sabe la web (places.ts, copy.ts).
import generated from "./generated.json";
import { CAMPUS_CITY, CITIES, TESTED_BY, UNIVERSITY_NAME, type CityId } from "./places";
import { CONFIRMED, TOOL_COPY } from "./copy";
import { RADIUS, percent } from "../lib/projection";

export const PKG = generated.paquete;
export const VERSION = generated.version;
export const REPO = "https://github.com/HyNuwa/UniMCP";

const unplaced = generated.campus.filter((c) => !CAMPUS_CITY[c.id]).map((c) => c.id);
if (unplaced.length) throw new Error(`Falta la ciudad de estos campus en src/data/places.ts: ${unplaced.join(", ")}`);

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
        aula: campus.some((c) => c.aula),
        guarani: campus.some((c) => c.guarani),
        testedBy: TESTED_BY[sigla],
    };
});

/** Un pin por ciudad, ubicado con la misma proyección que dibujó el mapa. */
export const PINS = (Object.keys(CITIES) as CityId[])
    .map((id) => ({ id, ...CITIES[id], ...percent(RADIUS.argentina, CITIES[id].lon, CITIES[id].lat), label: UNIVERSITIES.filter((u) => u.cities.includes(id)).map((u) => u.id).join(" · ") }))
    .filter((p) => p.label);

/** El pin del globo: el promedio de las ciudades. */
export const WORLD_PIN = percent(
    RADIUS.mundo,
    PINS.reduce((s, p) => s + p.lon, 0) / PINS.length,
    PINS.reduce((s, p) => s + p.lat, 0) / PINS.length,
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
};

/** "UNJu, UNSa, UNT, UBA y UTN". */
export const UNIVERSITY_LIST = UNIVERSITIES.map((u) => u.id).join(", ").replace(/, ([^,]*)$/, " y $1");

/** Un archivo de public/, con la base del sitio (en GitHub Pages es /UniMCP/). */
export const asset = (path: string) => import.meta.env.BASE_URL.replace(/\/?$/, "/") + path;
