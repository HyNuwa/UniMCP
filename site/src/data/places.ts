// Lo que la web sabe de cada campus y el servidor no: dónde queda, cómo se llama la universidad entera
// y quién la probó. Un campus nuevo en src/shared/campus.ts sin su ciudad acá frena el build.

/** Ciudades con campus. `province`: el nombre de la provincia en geoBoundaries (ARG ADM1), que pinta el mapa. */
export const CITIES = {
    jujuy: { name: "San Salvador de Jujuy", lon: -65.3, lat: -24.19, province: "Jujuy", side: "right" },
    salta: { name: "Salta", lon: -65.41, lat: -24.79, province: "Salta", side: "left" },
    tucuman: { name: "San Miguel de Tucumán", lon: -65.22, lat: -26.83, province: "Tucumán", side: "right" },
    caba: { name: "Ciudad de Buenos Aires", lon: -58.38, lat: -34.6, province: "Ciudad Autónoma de Buenos Aires", side: "right" },
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
};

/** Nombre completo de cada universidad, por su sigla en campus.ts. */
export const UNIVERSITY_NAME: Record<string, string> = {
    UNJu: "Universidad Nacional de Jujuy",
    UNSa: "Universidad Nacional de Salta",
    UNT: "Universidad Nacional de Tucumán",
    UBA: "Universidad de Buenos Aires",
    UTN: "Universidad Tecnológica Nacional",
};

/** Universidades probadas a fondo con alumnos, con el usuario de GitHub de quien la probó. */
export const TESTED_BY: Record<string, string> = {
    UNJu: "HyNuwa",
};
