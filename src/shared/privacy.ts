/**
 * Datos personales de otras personas en el texto que escriben docentes y compañeros (#17). Un aviso puede
 * traer la lista de alumnos con DNI o legajo, o un post el teléfono de alguien: al usuario le sirve saber si
 * está él, no los datos de los demás. Las listas se resumen y los DNI, emails y teléfonos sueltos se tapan,
 * salvo los del usuario y los de contacto de la cátedra. Los nombres sueltos quedan: suelen ser el docente
 * que firma o el grupo.
 */

/** A quién no hay que taparle los datos: el usuario. */
export interface Self {
    /** Nombre completo, como lo tiene la plataforma ("Ana María Pérez"). */
    fullname?: string;
    /** Usuario, que en muchas universidades es el DNI. */
    username?: string;
}

/** Los datos de terceros se muestran solo si lo pide el usuario en su compu; hosteado, nunca. */
export function thirdPartyDataShown(local: boolean, raw = process.env.UNI_SHOW_THIRD_PARTY_DATA): boolean {
    return local && raw === "1";
}

const DNI = /\b\d{1,2}\.?\d{3}\.?\d{3}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** Un legajo con letras adelante y al menos 5 dígitos: los códigos de materia ("IF159") tienen menos. */
const LEGAJO = /\b[A-Za-z]{1,3}[-\s]?\d{5,6}\b/;
/** Un teléfono argentino: característica y número (10 dígitos), con +54, 9 o 15 opcionales. */
const PHONE = /(?:\+?54[\s-]*9?[\s-]*)?\(?0?\d{2,4}\)?[\s-]*(?:15[\s-]*)?\d{3,4}[\s-]?\d{4}\b/g;
const URL_PART = /(https?:\/\/\S+)/;
/** Lo que viene antes de un número que no es de una persona: el id de una reunión, un código. */
const NOT_PERSONAL =
    /(\bid\b|reuni[oó]n|meeting|zoom|c[oó]digo|contraseña|clave|\bpin\b|expediente|resoluci[oó]n|res\.)\W{0,25}$/i;
/** Emails de contacto de la cátedra o de la facultad, aunque no sean institucionales. */
const CONTACT = /^(c[aá]tedra|consultas?|info|secretar[ií]a|alumnos|bedel[ií]a|dpto|departamento|mesa|tutor[ií]a)/i;
/** El encabezado de una tabla de alumnos. */
const ROSTER_HEADER = /\b(apellidos?|alumn[oa]s?|estudiantes?|dni|legajos?|l\.?\s?u\.?|libreta|documento)\b/i;
/**
 * Desde cuántas filas con datos un bloque es una lista de personas. En una tabla alcanzan dos (en UNJu, la
 * de los dados de baja de una materia tenía dos); en líneas sueltas, dos números pueden ser otra cosa.
 */
const MIN_TABLE_ROWS = 2;
const MIN_LINES = 3;

const normalize = (s: string) =>
    s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "");

/** Recorre la respuesta y protege cada texto; los números, las direcciones y las URLs quedan igual. */
export function withoutThirdPartyData<T>(value: T, self: Self): T {
    const walk = (v: unknown, key?: string): unknown => {
        if (typeof v === "string") return key && SKIP_KEYS.has(key) ? v : protectText(v, self);
        if (Array.isArray(v)) return v.map((item) => walk(item));
        if (v && Object.getPrototypeOf(v) === Object.prototype) {
            return Object.fromEntries(Object.entries(v).map(([k, item]) => [k, walk(item, k)]));
        }
        return v;
    };
    return walk(value) as T;
}

/** Campos que la plataforma o UniMCP arman, nunca un tercero. */
const SKIP_KEYS = new Set(["direccion", "padre", "url", "siguiente", "tipo"]);

/** Un texto con las listas de personas resumidas y los datos sueltos de otros tapados. */
export function protectText(text: string, self: Self): string {
    if (!/\d|@/.test(text)) return text;
    const lines = text.split("\n");
    const out: string[] = [];
    for (let i = 0; i < lines.length; ) {
        const roster = rosterAt(lines, i);
        if (roster) {
            out.push(summary(roster, self));
            i = roster.end;
        } else {
            out.push(maskLoose(lines[i], self));
            i++;
        }
    }
    return out.join("\n");
}

interface Roster {
    header?: string;
    rows: string[];
    end: number;
}

const isTableRow = (line: string) => line.includes(" | ");

/** Un DNI o un email; en una fila de tabla, también un legajo con letras ("L004512"). */
function hasPersonalId(line: string): boolean {
    const text = withoutUrls(line);
    const id = new RegExp(DNI.source).test(text) || new RegExp(EMAIL.source).test(text);
    return id || (isTableRow(text) && LEGAJO.test(text));
}

/**
 * Una lista de personas que empieza en `i`: una tabla con encabezado de alumnos, o filas seguidas con un DNI
 * o un email (una tabla sin encabezado, una lista o un PDF).
 */
function rosterAt(lines: string[], i: number): Roster | null {
    if (isTableRow(lines[i]) && ROSTER_HEADER.test(lines[i])) {
        let end = i + 1;
        while (end < lines.length && isTableRow(lines[end])) end++;
        if (end - i - 1 >= MIN_TABLE_ROWS) return { header: lines[i], rows: lines.slice(i + 1, end), end };
    }
    let end = i;
    while (end < lines.length && hasPersonalId(lines[end])) end++;
    const rows = lines.slice(i, end);
    const enough = rows.length >= (rows.every(isTableRow) ? MIN_TABLE_ROWS : MIN_LINES);
    return enough ? { rows, end } : null;
}

/** "[Lista de 34 personas con sus datos (Apellido y nombre | DNI | Condición): no figurás…]" */
function summary({ header, rows }: Roster, self: Self): string {
    const columns = header ? ` (${header.replace(/^\s*[-#]\s*/, "").trim()})` : "";
    const own = rows.map((row, n) => ({ row, n: n + 1 })).filter(({ row }) => isSelf(row, self));
    const verdict = own.length
        ? `figurás en ${own.length === 1 ? "la fila" : "las filas"} ${own.map((o) => o.n).join(", ")}: ` +
          own.map((o) => `«${o.row.replace(/^\s*-\s*/, "").trim()}»`).join(" ")
        : "no figurás (te busqué por tu nombre y tu usuario del aula)";
    return `[Lista de ${rows.length} personas con sus datos${columns}; UniMCP no la muestra: ${verdict}.]`;
}

/** Si la fila es del usuario: tiene su usuario (o DNI), o al menos dos palabras de su nombre. */
function isSelf(row: string, { fullname, username }: Self): boolean {
    const words = new Set(normalize(row).split(/[^a-z0-9]+/));
    if (username) {
        const user = normalize(username.trim());
        if (/^\d{7,8}$/.test(digits(user)) && digits(user) === user) {
            if ([...row.matchAll(DNI)].some((m) => digits(m[0]) === user)) return true;
        } else if (words.has(user)) return true;
    }
    const names = normalize(fullname ?? "")
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 3);
    const found = names.filter((w) => words.has(w)).length;
    return names.length > 0 && found >= Math.min(2, names.length);
}

/** Los pedazos del texto que no son URLs: un DNI dentro de un link no es de nadie. */
const withoutUrls = (line: string) => line.split(URL_PART).filter((_, i) => i % 2 === 0).join(" ");

/** Tapa los DNI, emails y teléfonos de otros en una línea, sin tocar las URLs. */
function maskLoose(line: string, self: Self): string {
    const own = self.username ? digits(self.username) : "";
    return line
        .split(URL_PART)
        .map((part, i) => {
            if (i % 2 === 1) return part;
            const withoutEmails = part.replace(EMAIL, (email) => (keepEmail(email) ? email : "[email]"));
            const withoutPhones = withoutEmails.replace(PHONE, (phone, offset: number) =>
                digits(phone).length >= 10 && personal(withoutEmails, offset) ? "[teléfono]" : phone,
            );
            return withoutPhones.replace(DNI, (dni, offset: number) =>
                digits(dni) !== own && personal(withoutPhones, offset) ? "[DNI]" : dni,
            );
        })
        .join("");
}

/** Si el número que empieza en `offset` puede ser de una persona, por lo que dice antes. */
const personal = (text: string, offset: number) => !NOT_PERSONAL.test(text.slice(Math.max(0, offset - 30), offset));

/** Los institucionales (`.edu.ar`) que no llevan un DNI, y los de contacto. */
function keepEmail(email: string): boolean {
    const [local, domain] = [email.slice(0, email.lastIndexOf("@")), email.slice(email.lastIndexOf("@") + 1)];
    if (CONTACT.test(local)) return true;
    return /\.edu(\.ar)?$/i.test(domain) && !/\d{6,}/.test(local);
}
