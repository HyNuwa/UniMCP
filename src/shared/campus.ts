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
    /** La provincia, como la nombra geoBoundaries salvo sus erratas (la web la pinta en el mapa); `login` busca por ella. */
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
    { id: "unsa-humanidades", universidad: "UNSa", nombre: "Facultad de Humanidades", provincia: "Salta", aula: { baseUrl: "https://fhvirtual.unsa.edu.ar/moodle" } },
    { id: "unsa-economicas", universidad: "UNSa", nombre: "Facultad de Ciencias Económicas, Jurídicas y Sociales", provincia: "Salta", aula: { baseUrl: "https://moodleeco.unsa.edu.ar/moodle" } },
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
    { id: "unt-arquitectura", universidad: "UNT", nombre: "Facultad de Arquitectura y Urbanismo", provincia: "Tucumán", aula: { baseUrl: "https://campus3.unt.edu.ar" } },
    { id: "unt-derecho", universidad: "UNT", nombre: "Facultad de Derecho y Ciencias Sociales", provincia: "Tucumán", aula: { baseUrl: "https://campus4.unt.edu.ar" } },
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
    { id: "utn-fra", universidad: "UTN", nombre: "Facultad Regional Avellaneda", provincia: "Buenos Aires", aula: { baseUrl: "https://www.utnfravirtual.org.ar" } },
    { id: "utn-frbb", universidad: "UTN", nombre: "Facultad Regional Bahía Blanca", provincia: "Buenos Aires", aula: { baseUrl: "https://aulavirtual.frbb.utn.edu.ar" } },
    { id: "utn-frgp", universidad: "UTN", nombre: "Facultad Regional General Pacheco", provincia: "Buenos Aires", aula: { baseUrl: "https://frgp.cvg.utn.edu.ar" } },
    { id: "utn-frlp", universidad: "UTN", nombre: "Facultad Regional La Plata", provincia: "Buenos Aires", aula: { baseUrl: "https://frlp.cvg.utn.edu.ar" } },
    { id: "utn-frp", universidad: "UTN", nombre: "Facultad Regional Paraná", provincia: "Entre Ríos", aula: { baseUrl: "https://frp.cvg.utn.edu.ar" } },
    { id: "utn-frre", universidad: "UTN", nombre: "Facultad Regional Resistencia", provincia: "Chaco", aula: { baseUrl: "https://frre.cvg.utn.edu.ar" } },
    { id: "utn-frro", universidad: "UTN", nombre: "Facultad Regional Rosario", provincia: "Santa Fe", aula: { baseUrl: "https://frro.cvg.utn.edu.ar" } },
    { id: "utn-frch", universidad: "UTN", nombre: "Facultad Regional Chubut", provincia: "Chubut", aula: { baseUrl: "https://frch.cvg.utn.edu.ar" } },
    { id: "utn-frcon", universidad: "UTN", nombre: "Facultad Regional Concordia", provincia: "Entre Ríos", aula: { baseUrl: "https://frcon.cvg.utn.edu.ar" } },
    { id: "utn-frlr", universidad: "UTN", nombre: "Facultad Regional La Rioja", provincia: "La Rioja", aula: { baseUrl: "https://frlr.cvg.utn.edu.ar" } },
    { id: "utn-frn", universidad: "UTN", nombre: "Facultad Regional del Neuquén", provincia: "Neuquén", aula: { baseUrl: "https://frn.cvg.utn.edu.ar" } },
    { id: "utn-frra", universidad: "UTN", nombre: "Facultad Regional Rafaela", provincia: "Santa Fe", aula: { baseUrl: "https://frra.cvg.utn.edu.ar" } },
    { id: "utn-frrq", universidad: "UTN", nombre: "Facultad Regional Reconquista", provincia: "Santa Fe", aula: { baseUrl: "https://frrq.cvg.utn.edu.ar" } },
    { id: "utn-frsc", universidad: "UTN", nombre: "Facultad Regional Santa Cruz", provincia: "Santa Cruz", aula: { baseUrl: "https://frsc.cvg.utn.edu.ar" } },
    { id: "utn-frsfco", universidad: "UTN", nombre: "Facultad Regional San Francisco", provincia: "Córdoba", aula: { baseUrl: "https://frsfco.cvg.utn.edu.ar" } },
    { id: "utn-frsr", universidad: "UTN", nombre: "Facultad Regional San Rafael", provincia: "Mendoza", aula: { baseUrl: "https://campus.frsr.utn.edu.ar/moodle" } },
    { id: "utn-frtl", universidad: "UTN", nombre: "Facultad Regional Trenque Lauquen", provincia: "Buenos Aires", aula: { baseUrl: "https://frtl.cvg.utn.edu.ar" } },
    { id: "utn-frvm", universidad: "UTN", nombre: "Facultad Regional Villa María", provincia: "Córdoba", aula: { baseUrl: "https://cvirtual.frvm.utn.edu.ar" } },
    { id: "unc-famaf", universidad: "UNC", nombre: "Facultad de Matemática, Astronomía, Física y Computación (FAMAF)", provincia: "Córdoba", aula: { baseUrl: "https://famaf.aulavirtual.unc.edu.ar" } },
    { id: "unicen-exactas", universidad: "UNICEN", nombre: "Facultad de Ciencias Exactas", provincia: "Buenos Aires", aula: { baseUrl: "https://moodle.exa.unicen.edu.ar" } },
    { id: "unicen-humanas", universidad: "UNICEN", nombre: "Facultad de Ciencias Humanas", provincia: "Buenos Aires", aula: { baseUrl: "https://campus.fch.unicen.edu.ar" } },
    { id: "uns", universidad: "UNS", nombre: "Universidad Nacional del Sur", provincia: "Buenos Aires", aula: { baseUrl: "https://moodle.uns.edu.ar/moodle" } },
    { id: "unne", universidad: "UNNE", nombre: "Universidad Nacional del Nordeste", provincia: "Corrientes", aula: { baseUrl: "https://virtual-moodle.unne.edu.ar" } },
    { id: "uner-ingenieria", universidad: "UNER", nombre: "Facultad de Ingeniería (FIUNER)", provincia: "Entre Ríos", aula: { baseUrl: "https://campus.ingenieria.uner.edu.ar" } },
    { id: "uncuyo-fad", universidad: "UNCuyo", nombre: "Facultad de Artes y Diseño", provincia: "Mendoza", aula: { baseUrl: "https://virtual.fad.uncu.edu.ar" } },
    { id: "uncuyo-ingenieria", universidad: "UNCuyo", nombre: "Facultad de Ingeniería", provincia: "Mendoza", aula: { baseUrl: "https://aulaabierta.ingenieria.uncuyo.edu.ar" } },
    { id: "unsj", universidad: "UNSJ", nombre: "Universidad Nacional de San Juan", provincia: "San Juan", aula: { baseUrl: "https://campusvirtual.unsj.edu.ar" } },
    { id: "unsl", universidad: "UNSL", nombre: "Universidad Nacional de San Luis", provincia: "San Luis", aula: { baseUrl: "https://moodle4vz.unsl.edu.ar/moodle" } },
    { id: "unlpam-agronomia", universidad: "UNLPam", nombre: "Facultad de Agronomía", provincia: "La Pampa", aula: { baseUrl: "https://v5.campus.agro.unlpam.edu.ar" } },
    { id: "unco", universidad: "UNCo", nombre: "Universidad Nacional del Comahue", provincia: "Neuquén", aula: { baseUrl: "https://pedco.uncoma.edu.ar" } },
    { id: "unco-medicas", universidad: "UNCo", nombre: "Facultad de Ciencias Médicas", provincia: "Río Negro", aula: { baseUrl: "https://campusvirtualfacimed.uncoma.edu.ar" } },
    { id: "unco-plena", universidad: "UNCo", nombre: "PLENA (Plataforma de Entorno Abierto)", provincia: "Neuquén", aula: { baseUrl: "https://plena.uncoma.edu.ar" } },
    { id: "unpsjb", universidad: "UNPSJB", nombre: "Universidad Nacional de la Patagonia San Juan Bosco", provincia: "Chubut", aula: { baseUrl: "https://campusvirtual.unp.edu.ar" } },
    { id: "untdf", universidad: "UNTDF", nombre: "Universidad Nacional de Tierra del Fuego", provincia: "Tierra del Fuego", aula: { baseUrl: "https://campus.untdf.edu.ar" } },
    { id: "unaf-recursos-naturales", universidad: "UNaF", nombre: "Facultad de Recursos Naturales", provincia: "Formosa", aula: { baseUrl: "https://frn.ead3.unf.edu.ar" } },
    { id: "unam-enfermeria", universidad: "UNaM", nombre: "Escuela de Enfermería", provincia: "Misiones", aula: { baseUrl: "https://aula.escenf.unam.edu.ar" } },
    { id: "unam-forestales", universidad: "UNaM", nombre: "Facultad de Ciencias Forestales", provincia: "Misiones", aula: { baseUrl: "https://campusvirtual.fcf.unam.edu.ar" } },
    { id: "unam-forestales-distancia", universidad: "UNaM", nombre: "Facultad de Ciencias Forestales (a distancia)", provincia: "Misiones", aula: { baseUrl: "https://aulavirtual.fcf.unam.edu.ar" } },
    { id: "unam-economicas", universidad: "UNaM", nombre: "Facultad de Ciencias Económicas", provincia: "Misiones", aula: { baseUrl: "https://aulavirtual.fce.unam.edu.ar" } },
    { id: "unam-economicas-distancia", universidad: "UNaM", nombre: "Facultad de Ciencias Económicas (a distancia)", provincia: "Misiones", aula: { baseUrl: "https://ead.fce.unam.edu.ar" } },
    { id: "unam-exactas", universidad: "UNaM", nombre: "Facultad de Ciencias Exactas, Químicas y Naturales", provincia: "Misiones", aula: { baseUrl: "https://www.fceqyn.unam.edu.ar/moodle" } },
    { id: "unam-humanidades", universidad: "UNaM", nombre: "Facultad de Humanidades y Ciencias Sociales", provincia: "Misiones", aula: { baseUrl: "https://virtual.fhycs.unam.edu.ar" } },
    { id: "unam-ingenieria", universidad: "UNaM", nombre: "Facultad de Ingeniería", provincia: "Misiones", aula: { baseUrl: "https://aulavirtual.fio.unam.edu.ar" } },
    { id: "unca", universidad: "UNCA", nombre: "Universidad Nacional de Catamarca", provincia: "Catamarca", aula: { baseUrl: "https://campus.unca.edu.ar/campus" } },
    { id: "unlar", universidad: "UNLaR", nombre: "Universidad Nacional de La Rioja", provincia: "La Rioja", aula: { baseUrl: "https://campusvirtual.unlar.edu.ar" } },
    { id: "unse", universidad: "UNSE", nombre: "Campus virtual (SIED)", provincia: "Santiago del Estero", aula: { baseUrl: "https://campusvirtual.unse.edu.ar" } },
    { id: "unse-fceyt", universidad: "UNSE", nombre: "Facultad de Ciencias Exactas y Tecnologías", provincia: "Santiago del Estero", aula: { baseUrl: "https://cuv-fceyt.unse.edu.ar" } },
    { id: "unlp-naturales", universidad: "UNLP", nombre: "Facultad de Ciencias Naturales y Museo", provincia: "Buenos Aires", aula: { baseUrl: "https://aulasvirtuales.fcnym.unlp.edu.ar" } },
    { id: "unlp-aulasweb-grado", universidad: "UNLP", nombre: "AulasWeb Grado (varias facultades)", provincia: "Buenos Aires", aula: { baseUrl: "https://aulaswebgrado.ead.unlp.edu.ar" } },
    { id: "unlp-aulasweb-posgrado", universidad: "UNLP", nombre: "AulasWeb Posgrado (varias facultades)", provincia: "Buenos Aires", aula: { baseUrl: "https://aulaswebposgrado.ead.unlp.edu.ar" } },
    { id: "unr-comunidades", universidad: "UNR", nombre: "Comunidades (plataforma general)", provincia: "Santa Fe", aula: { baseUrl: "https://comunidades.campusvirtualunr.edu.ar" } },
    { id: "unr-carreras-cursos", universidad: "UNR", nombre: "Carreras y Cursos (a distancia)", provincia: "Santa Fe", aula: { baseUrl: "https://cursos.campusvirtualunr.edu.ar" } },
    { id: "unr-derecho", universidad: "UNR", nombre: "Facultad de Derecho", provincia: "Santa Fe", aula: { baseUrl: "https://comunidades5.campusvirtualunr.edu.ar" } },
    { id: "unr-economicas", universidad: "UNR", nombre: "Facultad de Ciencias Económicas y Estadística", provincia: "Santa Fe", aula: { baseUrl: "https://comunidades3.campusvirtualunr.edu.ar" } },
    { id: "unr-humanidades-artes", universidad: "UNR", nombre: "Facultad de Humanidades y Artes", provincia: "Santa Fe", aula: { baseUrl: "https://comunidades4.campusvirtualunr.edu.ar" } },
    { id: "unr-medicas", universidad: "UNR", nombre: "Facultad de Ciencias Médicas", provincia: "Santa Fe", aula: { baseUrl: "https://comunidades2.campusvirtualunr.edu.ar" } },
    { id: "unr-psicologia", universidad: "UNR", nombre: "Facultad de Psicología", provincia: "Santa Fe", aula: { baseUrl: "https://comunidades1.campusvirtualunr.edu.ar" } },
    { id: "unvm", universidad: "UNVM", nombre: "Campus virtual", provincia: "Córdoba", aula: { baseUrl: "https://campusvirtual.unvm.edu.ar" } },
    { id: "unvm-distancia", universidad: "UNVM", nombre: "Educación a distancia", provincia: "Córdoba", aula: { baseUrl: "https://distancia.unvm.edu.ar" } },
    { id: "uader", universidad: "UADER", nombre: "Campus de educación a distancia", provincia: "Entre Ríos", aula: { baseUrl: "https://campusuader.entrerios.gov.ar" } },
    { id: "uader-gestion", universidad: "UADER", nombre: "Facultad de Ciencias de la Gestión", provincia: "Entre Ríos", aula: { baseUrl: "https://fcgvirtual.entrerios.gov.ar" } },
    { id: "uader-vida-salud", universidad: "UADER", nombre: "Facultad de Ciencias de la Vida y la Salud", provincia: "Entre Ríos", aula: { baseUrl: "https://fcvsvirtual.entrerios.gov.ar" } },
    { id: "uader-ciencia-tecnologia", universidad: "UADER", nombre: "Facultad de Ciencia y Tecnología", provincia: "Entre Ríos", aula: { baseUrl: "https://fcytvirtual.entrerios.gov.ar" } },
    { id: "uader-humanidades", universidad: "UADER", nombre: "Facultad de Humanidades, Artes y Ciencias Sociales", provincia: "Entre Ríos", aula: { baseUrl: "https://fhaycsvirtual.uader.edu.ar" } },
    { id: "unl-economicas", universidad: "UNL", nombre: "Facultad de Ciencias Económicas", provincia: "Santa Fe", aula: { baseUrl: "https://servicios.unl.edu.ar/aulavirtual/fce" } },
    { id: "unl-ingenieria-quimica", universidad: "UNL", nombre: "Facultad de Ingeniería Química", provincia: "Santa Fe", aula: { baseUrl: "https://servicios.unl.edu.ar/aulavirtual/fiq" } },
    { id: "unlu", universidad: "UNLu", nombre: "Universidad Nacional de Luján", provincia: "Buenos Aires", aula: { baseUrl: "https://moodle.unlu.edu.ar" } },
    { id: "unmdp-faud", universidad: "UNMdP", nombre: "Facultad de Arquitectura, Urbanismo y Diseño", provincia: "Buenos Aires", aula: { baseUrl: "https://campusfaud.mdp.edu.ar" } },
    { id: "unsam-unidad-central", universidad: "UNSAM", nombre: "Unidad Central", provincia: "Buenos Aires", aula: { baseUrl: "https://campusvirtualunidadcentral.unsam.edu.ar" } },
    { id: "unsam-ciencia-tecnologia", universidad: "UNSAM", nombre: "Ciencia y Tecnología (ECyT, EByN, INCALIN, Sabato y Dan Beninson)", provincia: "Buenos Aires", aula: { baseUrl: "https://campusvirtualecyt.unsam.edu.ar" } },
    { id: "unsam-economia-negocios", universidad: "UNSAM", nombre: "Escuela de Economía y Negocios", provincia: "Buenos Aires", aula: { baseUrl: "https://campusvirtualeeyn.unsam.edu.ar" } },
    { id: "unsam-habitat-arte-rehabilitacion", universidad: "UNSAM", nombre: "Escuelas de Hábitat y Sostenibilidad, Arte y Patrimonio e ICRM", provincia: "Buenos Aires", aula: { baseUrl: "https://campusvirtualhsyaeicrm.unsam.edu.ar" } },
    { id: "unsam-humanidades", universidad: "UNSAM", nombre: "Escuela de Humanidades", provincia: "Buenos Aires", aula: { baseUrl: "https://campusvirtualhu.unsam.edu.ar" } },
    { id: "unsam-lenguas", universidad: "UNSAM", nombre: "Programa de Lenguas", provincia: "Buenos Aires", aula: { baseUrl: "https://campusvirtuallenguas.unsam.edu.ar" } },
    { id: "unsam-sociales", universidad: "UNSAM", nombre: "Sociales (EPyG e EIDAES)", provincia: "Buenos Aires", aula: { baseUrl: "https://campusvirtualsociales.unsam.edu.ar" } },
    { id: "unahur", universidad: "UNAHUR", nombre: "Universidad Nacional de Hurlingham", provincia: "Buenos Aires", aula: { baseUrl: "https://campus2026.unahur.edu.ar" } },
    { id: "unpaz", universidad: "UNPAZ", nombre: "Universidad Nacional de José C. Paz", provincia: "Buenos Aires", aula: { baseUrl: "https://campusvirtual.unpaz.edu.ar" } },
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
