import { load, type CheerioAPI } from "cheerio";

interface Commission {
    comision: string;
    turno?: string;
    cupo?: string;
    inscriptos?: number;
    instancias?: string;
    ubicacion?: string;
    docentes?: string;
    observaciones?: string;
    /** Un dato del recuadro que no es ninguno de los conocidos, con la etiqueta que le da Guaraní. */
    otros?: Record<string, string>;
    /** "Tipo de clase | Día | Horario | Aula", en el orden de `columnasHorarios`. */
    horarios?: string[];
}

export interface OfferedSubject {
    materia: string;
    codigo?: string;
    comisiones: Commission[];
}

export interface Period {
    periodo: string;
    materias: OfferedSubject[];
}

export interface CommissionOffer {
    oferta: Period[];
    /** Las columnas de los `horarios`, como las nombra Guaraní. */
    columnasHorarios?: string;
}

/** Lo que G3W pone cuando todavía no hay dato. */
const UNDEFINED = /^(sin definir|aula a determinar|a determinar|-)$/i;
/** "PROBABILIDADES Y ESTADISTICA (IF008)". */
const NAME_AND_CODE = /^(.*?)\s*\(([^()]+)\)$/;

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

type Selection = ReturnType<CheerioAPI>;

/**
 * La oferta de comisiones de G3W por período, materia y comisión: cada materia es un
 * `.js-recuadro_actividad[actividad]` y cada comisión una `table.comision`, con el recuadro de datos
 * ("<strong>Turno:</strong> Mañana") y la tabla de horarios. Si la página no tiene esa forma, `undefined`.
 */
export function commissionOffer(html: string): CommissionOffer | undefined {
    const $ = load(html, null, false);
    const blocks = $(".js-recuadro_actividad[actividad]");
    if (!blocks.length) return undefined;

    let columns: string | undefined;
    const oferta: Period[] = [];
    blocks.each((_, block) => {
        const periodo = clean($(block).closest(".js-recuadro_periodo").children("h3").first().text())
            .replace(/^Período lectivo:\s*/i, "");
        const { materia, codigo } = nameAndCode(clean($(block).attr("actividad") ?? ""));
        const comisiones: Commission[] = [];
        $(block)
            .find("table.comision")
            .each((_, table) => {
                const { commission, header } = readCommission($, $(table));
                columns ??= header;
                comisiones.push(commission);
            });
        // Las materias de un período van juntas: así el período no se repite en cada una.
        let period = oferta.find((p) => p.periodo === periodo);
        if (!period) oferta.push((period = { periodo, materias: [] }));
        period.materias.push({ materia, codigo, comisiones });
    });
    return { oferta, columnasHorarios: columns };
}

function readCommission($: CheerioAPI, table: Selection): { commission: Commission; header?: string } {
    const commission: Commission = { comision: clean(table.find("h5").first().text()).replace(/^Comisión:\s*/i, "") };
    table.find(".detalle_comision strong").each((_, strong) => {
        const label = clean($(strong).text());
        // El valor es lo que sigue a la etiqueta dentro de su `span` (o de la celda): "Turno: Mañana".
        const holder = clean($(strong).parent().text());
        const value = clean(holder.slice(holder.indexOf(label) + label.length));
        if (value && !UNDEFINED.test(value)) setField(commission, label.replace(/:$/, ""), value);
    });

    const rows = table.find("tr.horarios");
    const header = rows.filter(".encabezados").first();
    const horarios = rows
        .not(".encabezados")
        .toArray()
        .map((tr) => $(tr).children("td").toArray().map((td) => clean($(td).text())))
        // Una fila sin ningún dato ("Sin definir | … | Aula a determinar") no informa nada.
        .filter((cells) => cells.some((c) => c && !UNDEFINED.test(c)))
        .map((cells) => cells.join(" | "));
    if (horarios.length) commission.horarios = horarios;
    const names = header.children("th, td").toArray().map((th) => clean($(th).text()));
    return { commission, header: names.length ? names.join(" | ") : undefined };
}

/** Los datos conocidos del recuadro van con nombre propio; el resto, en `otros` con su etiqueta. */
function setField(c: Commission, label: string, value: string) {
    switch (label.toLowerCase()) {
        case "turno":
            c.turno = value;
            return;
        case "cupo / insc.": {
            // "40 / 12": cupo e inscriptos. El cupo puede ser "Sin definir".
            const [cupo, insc] = value.split("/").map(clean);
            if (cupo && !UNDEFINED.test(cupo)) c.cupo = cupo;
            if (insc && /^\d+$/.test(insc)) c.inscriptos = Number(insc);
            return;
        }
        case "instancias":
            c.instancias = value;
            return;
        case "ubicación":
        case "ubicacion":
            c.ubicacion = value;
            return;
        case "docentes":
            c.docentes = value;
            return;
        case "observaciones":
            c.observaciones = value;
            return;
        default:
            c.otros = { ...c.otros, [label]: value };
    }
}

function nameAndCode(title: string): { materia: string; codigo?: string } {
    const m = NAME_AND_CODE.exec(title);
    return m ? { materia: m[1], codigo: m[2] } : { materia: title };
}
