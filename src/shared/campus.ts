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
    aula?: AulaSite;
    guarani?: GuaraniSite;
}

// Verificados con `tool_mobile_get_public_config` (servicio móvil habilitado) y la página de login de G3W.
const UNJU_GUARANI = { baseUrl: "https://alumnos.unju.edu.ar/unju" };
const UNSA_GUARANI = { baseUrl: "https://autogestiong3.unsa.edu.ar/autogestion" };
const UNT_GUARANI = { baseUrl: "https://guarani.unt.edu.ar/autogestion" };

const CAMPUSES: Campus[] = [
    {
        id: "unju",
        universidad: "UNJu",
        nombre: "Universidad Nacional de Jujuy",
        aula: { baseUrl: "https://virtual.unju.edu.ar" },
        guarani: UNJU_GUARANI,
    },
    {
        id: "unsa-exactas",
        universidad: "UNSa",
        nombre: "Facultad de Ciencias Exactas",
        aula: { baseUrl: "https://exavirtual.unsa.edu.ar" },
        guarani: UNSA_GUARANI,
    },
    {
        id: "unsa-salud",
        universidad: "UNSa",
        nombre: "Facultad de Ciencias de la Salud",
        aula: { baseUrl: "https://saludvirtual.unsa.edu.ar" },
        guarani: UNSA_GUARANI,
    },
    { id: "unsa", universidad: "UNSa", nombre: "Otras facultades (solo Guaraní)", guarani: UNSA_GUARANI },
    {
        id: "unt-facet",
        universidad: "UNT",
        nombre: "Facultad de Ciencias Exactas y Tecnología (FACET)",
        aula: { baseUrl: "https://facetvirtual.facet.unt.edu.ar" },
        guarani: UNT_GUARANI,
    },
    {
        id: "unt-face",
        universidad: "UNT",
        nombre: "Facultad de Ciencias Económicas",
        aula: { baseUrl: "https://campus2.unt.edu.ar" },
        guarani: UNT_GUARANI,
    },
    {
        id: "unt-filo",
        universidad: "UNT",
        nombre: "Facultad de Filosofía y Letras",
        aula: { baseUrl: "https://campus.filo.unt.edu.ar" },
        guarani: UNT_GUARANI,
    },
    { id: "unt", universidad: "UNT", nombre: "Otras facultades (solo Guaraní)", guarani: UNT_GUARANI },
    {
        id: "uba-fiuba",
        universidad: "UBA",
        nombre: "Facultad de Ingeniería (FIUBA)",
        aula: { baseUrl: "https://campusgrado.fi.uba.ar" },
        guarani: { baseUrl: "https://guaraniautogestion.fi.uba.ar/g3w" },
    },
    {
        id: "uba-exactas",
        universidad: "UBA",
        nombre: "Facultad de Ciencias Exactas y Naturales",
        aula: { baseUrl: "https://campus.exactas.uba.ar", ssoHost: "acceso.exactas.uba.ar" },
        guarani: { baseUrl: "https://inscripciones.exactas.uba.ar/autogestion" },
    },
    {
        id: "utn-frba",
        universidad: "UTN",
        nombre: "Facultad Regional Buenos Aires",
        aula: { baseUrl: "https://aulasvirtuales.frba.utn.edu.ar", ssoHost: "auth.frba.utn.edu.ar" },
    },
    { id: "utn-frt", universidad: "UTN", nombre: "Facultad Regional Tucumán", aula: { baseUrl: "https://frt.cvg.utn.edu.ar" } },
];

/** Id del campus armado con `UNI_AULA_BASE_URL` / `UNI_GUARANI_URL`, que no está en el registro. */
export const CUSTOM_CAMPUS = "personalizado";

export const listCampuses = (): readonly Campus[] => CAMPUSES;

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
 * El campus del modo local: `UNI_CAMPUS`; si no, el que se eligió en `mcp-uni-arg login`; si no, uno
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
