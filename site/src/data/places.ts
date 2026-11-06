// Lo que la web sabe de cada campus y el servidor no: dónde queda, cómo se llama la universidad entera
// y quién la probó. Un campus nuevo en src/shared/campus.ts sin su ciudad acá frena el build, y también una
// ciudad en otra provincia que la del campus.

/**
 * Ciudades con campus. `province`: el nombre de la provincia en geoBoundaries (ARG ADM1), que pinta el mapa,
 * igual a la `provincia` de sus campus. `side`: de qué lado del pin va la etiqueta, para que no se pisen.
 */
export const CITIES = {
    jujuy: { name: "San Salvador de Jujuy", lon: -65.3, lat: -24.19, province: "Jujuy", side: "right" },
    salta: { name: "Salta", lon: -65.41, lat: -24.79, province: "Salta", side: "left" },
    tucuman: { name: "San Miguel de Tucumán", lon: -65.22, lat: -26.83, province: "Tucumán", side: "right" },
    caba: { name: "Ciudad de Buenos Aires", lon: -58.38, lat: -34.6, province: "Ciudad Autónoma de Buenos Aires", side: "right" },
    corrientes: { name: "Corrientes", lon: -58.83, lat: -27.47, province: "Corrientes", side: "right" },
    cordoba: { name: "Córdoba", lon: -64.18, lat: -31.42, province: "Córdoba", side: "left" },
    santafe: { name: "Santa Fe", lon: -60.7, lat: -31.63, province: "Santa Fe", side: "right" },
    parana: { name: "Paraná", lon: -60.53, lat: -31.73, province: "Entre Ríos", side: "right" },
    sanjuan: { name: "San Juan", lon: -68.54, lat: -31.54, province: "San Juan", side: "left" },
    mendoza: { name: "Mendoza", lon: -68.83, lat: -32.89, province: "Mendoza", side: "left" },
    sanluis: { name: "San Luis", lon: -66.34, lat: -33.3, province: "San Luis", side: "left" },
    tandil: { name: "Tandil", lon: -59.13, lat: -37.32, province: "Buenos Aires", side: "right" },
    santarosa: { name: "Santa Rosa", lon: -64.29, lat: -36.62, province: "La Pampa", side: "left" },
    bahia: { name: "Bahía Blanca", lon: -62.27, lat: -38.72, province: "Buenos Aires", side: "right" },
    neuquen: { name: "Neuquén", lon: -68.06, lat: -38.95, province: "Neuquén", side: "left" },
    comodoro: { name: "Comodoro Rivadavia", lon: -67.48, lat: -45.86, province: "Chubut", side: "right" },
    ushuaia: { name: "Ushuaia", lon: -68.3, lat: -54.8, province: "Tierra del Fuego", side: "right" },
} as const;

export type CityId = keyof typeof CITIES;

/** Ciudad de cada campus, por su id en campus.ts. */
export const CAMPUS_CITY: Record<string, CityId> = {
    unju: "jujuy",
    "unsa-exactas": "salta",
    "unsa-salud": "salta",
    unsa: "salta",
    "unt-facet": "tucuman",
    "unt-face": "tucuman",
    "unt-filo": "tucuman",
    unt: "tucuman",
    "uba-fiuba": "caba",
    "uba-exactas": "caba",
    "utn-frba": "caba",
    "utn-frt": "tucuman",
    "uba-agronomia": "caba",
    "uba-farmacia": "caba",
    "uba-filo": "caba",
    "uba-sociales": "caba",
    "utn-frc": "cordoba",
    "utn-frsf": "santafe",
    "unc-famaf": "cordoba",
    "unicen-exactas": "tandil",
    uns: "bahia",
    unne: "corrientes",
    "uner-ingenieria": "parana",
    "uncuyo-fad": "mendoza",
    unsj: "sanjuan",
    unsl: "sanluis",
    "unlpam-agronomia": "santarosa",
    unco: "neuquen",
    unpsjb: "comodoro",
    untdf: "ushuaia",
};

/** Nombre completo de cada universidad, por su sigla en campus.ts. */
export const UNIVERSITY_NAME: Record<string, string> = {
    UNJu: "Universidad Nacional de Jujuy",
    UNSa: "Universidad Nacional de Salta",
    UNT: "Universidad Nacional de Tucumán",
    UBA: "Universidad de Buenos Aires",
    UTN: "Universidad Tecnológica Nacional",
    UNC: "Universidad Nacional de Córdoba",
    UNICEN: "Universidad Nacional del Centro de la Provincia de Buenos Aires",
    UNS: "Universidad Nacional del Sur",
    UNNE: "Universidad Nacional del Nordeste",
    UNER: "Universidad Nacional de Entre Ríos",
    UNCuyo: "Universidad Nacional de Cuyo",
    UNSJ: "Universidad Nacional de San Juan",
    UNSL: "Universidad Nacional de San Luis",
    UNLPam: "Universidad Nacional de La Pampa",
    UNCo: "Universidad Nacional del Comahue",
    UNPSJB: "Universidad Nacional de la Patagonia San Juan Bosco",
    UNTDF: "Universidad Nacional de Tierra del Fuego",
};

/** Universidades probadas a fondo con alumnos, con el usuario de GitHub de quien la probó. */
export const TESTED_BY: Record<string, string> = {
    UNJu: "HyNuwa",
};
