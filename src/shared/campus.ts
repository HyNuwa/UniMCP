import { readFileSync } from "node:fs";
import { campusFile } from "./paths.js";

/** El aula virtual (Moodle) de un campus. `ssoHost`: el host del SSO (Keycloak), si el login pasa por uno. */
export interface AulaSite {
    baseUrl: string;
    ssoHost?: string;
}

/** La autogestión de SIU Guaraní 3 (G3W), con la ruta de la aplicación: `https://host/autogestion`. */
export interface GuaraniSite {
    baseUrl: string;
}

/**
 * Un campus es una facultad (o una universidad entera) con su aula y su Guaraní. El Guaraní suele ser
 * uno por universidad y el aula una por facultad, así que varias entradas comparten el mismo Guaraní.
 */
export interface Campus {
    id: string;
    universidad: string;
    nombre: string;
    /** La provincia, como la nombra geoBoundaries (la web la pinta en el mapa); `login` busca por ella. */
    provincia?: string;
    aula?: AulaSite;
    guarani?: GuaraniSite;
}

// Verificados con `tool_mobile_get_public_config` (servicio móvil habilitado) y la página de login de G3W.
// Un aula entra si tiene el servicio móvil y login propio (`typeoflogin` 1), sin un SSO para alumnos que
// no sea Keycloak: con OAuth2 o un portal propio, el login de usuario y contraseña no sirve.
const UNJU_GUARANI = { baseUrl: "https://alumnos.unju.edu.ar/unju" };
const UNSA_GUARANI = { baseUrl: "https://autogestiong3.unsa.edu.ar/autogestion" };
const UNT_GUARANI = { baseUrl: "https://guarani.unt.edu.ar/autogestion" };

const CAMPUSES: Campus[] = [
    {
        id: "unju",
        universidad: "UNJu",
        nombre: "Universidad Nacional de Jujuy",
        provincia: "Jujuy",
        aula: { baseUrl: "https://virtual.unju.edu.ar" },
        guarani: UNJU_GUARANI,
    },
    {
        id: "unsa-exactas",
        universidad: "UNSa",
        nombre: "Facultad de Ciencias Exactas",
        provincia: "Salta",
        aula: { baseUrl: "https://exavirtual.unsa.edu.ar" },
        guarani: UNSA_GUARANI,
    },
    {
        id: "unsa-salud",
        universidad: "UNSa",
        nombre: "Facultad de Ciencias de la Salud",
        provincia: "Salta",
        aula: { baseUrl: "https://saludvirtual.unsa.edu.ar" },
        guarani: UNSA_GUARANI,
    },
    { id: "unsa", universidad: "UNSa", nombre: "Otras facultades (solo Guaraní)", provincia: "Salta", guarani: UNSA_GUARANI },
    {
        id: "unt-facet",
        universidad: "UNT",
        nombre: "Facultad de Ciencias Exactas y Tecnología (FACET)",
        provincia: "Tucumán",
        aula: { baseUrl: "https://facetvirtual.facet.unt.edu.ar" },
        guarani: UNT_GUARANI,
    },
    {
        id: "unt-face",
        universidad: "UNT",
        nombre: "Facultad de Ciencias Económicas",
        provincia: "Tucumán",
        aula: { baseUrl: "https://campus2.unt.edu.ar" },
        guarani: UNT_GUARANI,
    },
    {
        id: "unt-filo",
        universidad: "UNT",
        nombre: "Facultad de Filosofía y Letras",
        provincia: "Tucumán",
        aula: { baseUrl: "https://campus.filo.unt.edu.ar" },
        guarani: UNT_GUARANI,
    },
    { id: "unt", universidad: "UNT", nombre: "Otras facultades (solo Guaraní)", provincia: "Tucumán", guarani: UNT_GUARANI },
    {
        id: "uba-fiuba",
        universidad: "UBA",
        nombre: "Facultad de Ingeniería (FIUBA)",
        provincia: "Ciudad Autónoma de Buenos Aires",
        aula: { baseUrl: "https://campusgrado.fi.uba.ar" },
        guarani: { baseUrl: "https://guaraniautogestion.fi.uba.ar/g3w" },
    },
    {
        id: "uba-exactas",
        universidad: "UBA",
        nombre: "Facultad de Ciencias Exactas y Naturales",
        provincia: "Ciudad Autónoma de Buenos Aires",
        aula: { baseUrl: "https://campus.exactas.uba.ar", ssoHost: "acceso.exactas.uba.ar" },
        guarani: { baseUrl: "https://inscripciones.exactas.uba.ar/autogestion" },
    },
    { id: "uba-agronomia", universidad: "UBA", nombre: "Facultad de Agronomía (FAUBA)", provincia: "Ciudad Autónoma de Buenos Aires", aula: { baseUrl: "https://campus.agro.uba.ar" } },
    { id: "uba-farmacia", universidad: "UBA", nombre: "Facultad de Farmacia y Bioquímica", provincia: "Ciudad Autónoma de Buenos Aires", aula: { baseUrl: "https://campus.ffyb.uba.ar" } },
    { id: "uba-filo", universidad: "UBA", nombre: "Facultad de Filosofía y Letras", provincia: "Ciudad Autónoma de Buenos Aires", aula: { baseUrl: "https://campus.filo.uba.ar" } },
    { id: "uba-sociales", universidad: "UBA", nombre: "Facultad de Ciencias Sociales", provincia: "Ciudad Autónoma de Buenos Aires", aula: { baseUrl: "https://campus.sociales.uba.ar" } },
    {
        id: "utn-frba",
        universidad: "UTN",
        nombre: "Facultad Regional Buenos Aires",
        provincia: "Ciudad Autónoma de Buenos Aires",
        aula: { baseUrl: "https://aulasvirtuales.frba.utn.edu.ar", ssoHost: "auth.frba.utn.edu.ar" },
    },
    { id: "utn-frt", universidad: "UTN", nombre: "Facultad Regional Tucumán", provincia: "Tucumán", aula: { baseUrl: "https://frt.cvg.utn.edu.ar" } },
    { id: "utn-frc", universidad: "UTN", nombre: "Facultad Regional Córdoba", provincia: "Córdoba", aula: { baseUrl: "https://uv.frc.utn.edu.ar" } },
    { id: "utn-frsf", universidad: "UTN", nombre: "Facultad Regional Santa Fe", provincia: "Santa Fe", aula: { baseUrl: "https://campusvirtual.frsf.utn.edu.ar" } },
    { id: "unc-famaf", universidad: "UNC", nombre: "Facultad de Matemática, Astronomía, Física y Computación (FAMAF)", provincia: "Córdoba", aula: { baseUrl: "https://famaf.aulavirtual.unc.edu.ar" } },
    { id: "unicen-exactas", universidad: "UNICEN", nombre: "Facultad de Ciencias Exactas", provincia: "Buenos Aires", aula: { baseUrl: "https://moodle.exa.unicen.edu.ar" } },
    { id: "uns", universidad: "UNS", nombre: "Universidad Nacional del Sur", provincia: "Buenos Aires", aula: { baseUrl: "https://moodle.uns.edu.ar/moodle" } },
    { id: "unne", universidad: "UNNE", nombre: "Universidad Nacional del Nordeste", provincia: "Corrientes", aula: { baseUrl: "https://virtual-moodle.unne.edu.ar" } },
    { id: "uner-ingenieria", universidad: "UNER", nombre: "Facultad de Ingeniería (FIUNER)", provincia: "Entre Ríos", aula: { baseUrl: "https://campus.ingenieria.uner.edu.ar" } },
    { id: "uncuyo-fad", universidad: "UNCuyo", nombre: "Facultad de Artes y Diseño", provincia: "Mendoza", aula: { baseUrl: "https://virtual.fad.uncu.edu.ar" } },
    { id: "unsj", universidad: "UNSJ", nombre: "Universidad Nacional de San Juan", provincia: "San Juan", aula: { baseUrl: "https://campusvirtual.unsj.edu.ar" } },
    { id: "unsl", universidad: "UNSL", nombre: "Universidad Nacional de San Luis", provincia: "San Luis", aula: { baseUrl: "https://moodle4vz.unsl.edu.ar/moodle" } },
    { id: "unlpam-agronomia", universidad: "UNLPam", nombre: "Facultad de Agronomía", provincia: "La Pampa", aula: { baseUrl: "https://v5.campus.agro.unlpam.edu.ar" } },
    { id: "unco", universidad: "UNCo", nombre: "Universidad Nacional del Comahue", provincia: "Neuquén", aula: { baseUrl: "https://pedco.uncoma.edu.ar" } },
    { id: "unpsjb", universidad: "UNPSJB", nombre: "Universidad Nacional de la Patagonia San Juan Bosco", provincia: "Chubut", aula: { baseUrl: "https://campusvirtual.unp.edu.ar" } },
    { id: "untdf", universidad: "UNTDF", nombre: "Universidad Nacional de Tierra del Fuego", provincia: "Tierra del Fuego", aula: { baseUrl: "https://campus.untdf.edu.ar" } },
];

/** Id del campus armado con `UNI_AULA_BASE_URL` / `UNI_GUARANI_URL`, que no está en el registro. */
export const CUSTOM_CAMPUS = "personalizado";

export const listCampuses = (): readonly Campus[] => CAMPUSES;

/** Minúsculas y sin tildes, para comparar lo que se tipea con el registro. */
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Los campus que tienen todas las palabras de la búsqueda en su id, sigla, nombre o provincia, sin
 * importar tildes ni mayúsculas ("cordoba" encuentra Córdoba). Sin palabras, todos.
 */
export function searchCampuses(query: string, campuses: readonly Campus[] = CAMPUSES): Campus[] {
    const words = fold(query).split(/[^a-z0-9]+/).filter(Boolean);
    return campuses.filter((c) => {
        const text = fold([c.id, c.universidad, c.nombre, c.provincia ?? ""].join(" "));
        return words.every((w) => text.includes(w));
    });
}

/** El campus del registro con ese id, o el personalizado del entorno. */
export function findCampus(id: string): Campus | null {
    const key = id.trim().toLowerCase();
    if (key === CUSTOM_CAMPUS) return customCampus();
    return CAMPUSES.find((c) => c.id === key) ?? null;
}

/** Como findCampus, pero un id desconocido es un error que dice cuáles hay. */
export function requireCampus(id: string): Campus {
    const campus = findCampus(id);
    if (!campus) {
        throw new Error(`No conozco el campus "${id}". Los disponibles son: ${CAMPUSES.map((c) => c.id).join(", ")}.`);
    }
    return campus;
}

/**
 * El campus del modo local: `UNI_CAMPUS`; si no, el que se eligió en `unimcp login`; si no, uno
 * armado con `UNI_AULA_BASE_URL` / `UNI_GUARANI_URL`. Sin ninguno, null.
 */
export function localCampus(): Campus | null {
    const fromEnv = process.env.UNI_CAMPUS?.trim();
    if (fromEnv) return requireCampus(fromEnv);
    try {
        const saved = JSON.parse(readFileSync(campusFile(), "utf8")) as { campus?: string };
        if (saved.campus) return requireCampus(saved.campus);
    } catch {
        // Todavía no se corrió login.
    }
    return customCampus();
}

function customCampus(): Campus | null {
    const aulaUrl = process.env.UNI_AULA_BASE_URL?.trim();
    const guaraniUrl = process.env.UNI_GUARANI_URL?.trim();
    if (!aulaUrl && !guaraniUrl) return null;
    return {
        id: CUSTOM_CAMPUS,
        universidad: "Personalizado",
        nombre: aulaUrl ?? guaraniUrl!,
        aula: aulaUrl ? { baseUrl: trimSlash(aulaUrl), ssoHost: process.env.UNI_SSO_HOST?.trim() || undefined } : undefined,
        guarani: guaraniUrl ? { baseUrl: trimSlash(guaraniUrl) } : undefined,
    };
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");
