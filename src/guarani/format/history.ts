import { load } from "cheerio";
import { argentinaDay } from "../../shared/dates.js";
import { logger } from "../../shared/logger.js";

/** Un resultado de la historia: una cursada, una promoción, un examen o una equivalencia. */
interface HistoryRecord {
    tipo: string;
    /** Numérica, o la palabra si la escala no es de números ("Acreditado"). */
    nota?: number | string;
    resultado?: string;
    fecha?: string;
    vencimiento?: string;
    /** El vencimiento ya pasó a la fecha de la consulta. */
    vencida?: true;
    /** El texto tal cual, si no tiene la forma conocida: así no se pierde nada. */
    texto?: string;
}

interface Subject {
    materia: string;
    codigo?: string;
    registros: HistoryRecord[];
}

/** Lo que se le muestra al modelo de la historia. */
export interface AcademicHistory {
    historia: Subject[];
    /** El día contra el que se calculó `vencida`, en hora argentina. */
    fechaConsulta: string;
    /** Registros que no tienen la forma conocida y van con su `texto`: si aparecen, G3W cambió algo. */
    registrosSinParsear?: number;
}

/** "dd/mm/aaaa", la forma en que G3W escribe las fechas. */
const DATE = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
/** La nota con su versión en letras: "8 (Ocho)", "6,50 (Seis con cincuenta)", o una letra: "A (Acreditado)". */
const GRADE = /^(\d+(?:[.,]\d+)?|[A-Z]{1,2})\s*\(([^)]*)\)\s*/;
/** Resultados con los que la regularidad no vale: Guaraní igual les muestra un vencimiento. */
const NOT_VALID = /reprobad|ausente|libre/i;
/** Lo que no cierra la materia: con la misma fecha, va después del resultado final. */
const PARTIAL = /regularidad|en curso/i;
/** "ÁLGEBRA LINEAL (IF156)": el código va entre paréntesis al final. */
const NAME_AND_CODE = /^(.*?)\s*\(([^()]+)\)$/;

/**
 * La historia académica por materia, del HTML de G3W: cada `.catedra` es un resultado con la materia en
 * el `h4` y "<strong>tipo</strong> - nota resultado fecha - Detalle" en el `span`. Una materia aparece
 * varias veces (regularidad, promoción, exámenes), así que se agrupa: el modelo ve de una su estado. Si la
 * página no tiene esa forma, `undefined`, y se muestra como texto. `today` ("aaaa-mm-dd") es para los tests.
 */
export function academicHistory(html: string, today = argentinaDay()): AcademicHistory | undefined {
    const $ = load(html, null, false);
    const rows = $(".catedra");
    if (!rows.length) return undefined;

    const subjects = new Map<string, Subject>();
    let unparsed = 0;
    rows.each((_, el) => {
        const row = $(el);
        const title = row.find(".catedra_nombre h4").first().text().replace(/\s+/g, " ").trim();
        if (!title) return;
        const span = row.find(".catedra_nombre span").first();
        const tipo = span.find("strong").first().text().replace(/\s+/g, " ").trim();
        // Sin el tipo y sin el link "Detalle", que abre un detalle por Ajax.
        span.find("strong, a").remove();
        const rest = span.text().replace(/\s+/g, " ").replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "").trim();
        const expiry = DATE.exec(row.find(".toggle_info_catedra").first().text());

        const key = title.toUpperCase();
        const subject = subjects.get(key) ?? { ...nameAndCode(title), registros: [] };
        subjects.set(key, subject);
        const record = parseResult(tipo, rest);
        const valid = !NOT_VALID.test(record.resultado ?? "");
        subject.registros.push({ ...record, vencimiento: expiry && valid ? isoDay(expiry) : undefined });
        if (record.texto) {
            unparsed++;
            // Sin números (notas, fechas): alcanza para ver la forma nueva sin dejar datos del alumno en el log.
            logger.warn(`Historia académica: registro sin parsear: "${tipo}" - "${rest.replace(/\d/g, "#")}"`);
        }
    });
    // Lo más reciente primero, así el primer registro es el estado actual. G3W ordena por año, y dentro del
    // año no siempre.
    for (const s of subjects.values()) {
        s.registros.sort(newestFirst);
        // Con la materia aprobada, la regularidad ya no importa: su vencimiento solo confunde.
        if (s.registros.some(isPassed)) for (const r of s.registros) r.vencimiento = undefined;
        // Las fechas "aaaa-mm-dd" se comparan como texto.
        for (const r of s.registros) if (r.vencimiento && r.vencimiento < today) r.vencida = true;
    }
    if (!subjects.size) return undefined;
    return { historia: [...subjects.values()], fechaConsulta: today, registrosSinParsear: unparsed || undefined };
}

function nameAndCode(title: string): Pick<Subject, "materia" | "codigo"> {
    const m = NAME_AND_CODE.exec(title);
    return m ? { materia: m[1], codigo: m[2] } : { materia: title };
}

/** "8 (Ocho) Promocionado 07/07/2026" → nota, resultado y fecha. "Inicio de dictado 10/08/2026" en una cursada en curso. */
function parseResult(tipo: string, rest: string): HistoryRecord {
    const date = DATE.exec(rest);
    const grade = GRADE.exec(rest);
    const resultado = rest.replace(GRADE, "").replace(DATE, "").replace(/\s+/g, " ").trim();
    // Sin fecha ni nota no es la forma conocida ("Aprobado 07/07/2026", "Inicio de dictado 10/08/2026"): va el texto.
    if (!date && !grade && resultado) return { tipo, texto: rest };
    return {
        tipo,
        nota: grade ? (/^\d/.test(grade[1]) ? Number(grade[1].replace(",", ".")) : grade[2].trim()) : undefined,
        resultado: resultado || undefined,
        fecha: date ? isoDay(date) : undefined,
    };
}

/** Un resultado final aprobado: promoción, examen o equivalencia. */
const isPassed = (r: HistoryRecord) => !PARTIAL.test(r.tipo) && /aprobad|promocionad/i.test(r.resultado ?? "");

function newestFirst(a: HistoryRecord, b: HistoryRecord): number {
    const byDate = (b.fecha ?? "").localeCompare(a.fecha ?? "");
    return byDate || Number(PARTIAL.test(a.tipo)) - Number(PARTIAL.test(b.tipo));
}

/** dd/mm/aaaa a aaaa-mm-dd: es un día, sin hora, así que no lleva zona. */
const isoDay = ([, d, m, y]: RegExpExecArray) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
