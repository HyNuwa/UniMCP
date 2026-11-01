// Los textos de la web que no salen del código: ejemplos, preguntas frecuentes y roadmap.
// Lo que sí sale del código (tools, campus, versión) se arma en site.ts.

/** Cómo le explicamos cada tool al alumno. Una tool sin entrada acá muestra la primera oración de su descripción. */
export const TOOL_COPY: Record<string, string> = {
    aula_list_courses: "Tus cursos. Es el punto de partida.",
    aula_open: "Abre un curso, una sección o un módulo.",
    aula_search: "Busca en uno o en todos tus cursos.",
    aula_list_upcoming: "Qué tenés que entregar y para cuándo.",
    aula_list_grades: "Tus notas y la devolución del docente.",
    aula_list_updates: "Qué cambió en tus materias estos días.",
    aula_list_messages: "Tus mensajes, sin marcarlos como leídos.",
    aula_read_file: "Lee un archivo, por partes si es largo.",
    aula_get_site_info: "Tus datos de usuario en el aula.",
    aula_assign_upload_link: "Un link para subir archivos de una entrega (modo HTTP).",
    guarani_menu: "Las operaciones que habilitó tu universidad.",
    guarani_open: "Historia, plan, oferta y mesas, por materia.",
    aula_forum_post: "Abre un hilo o responde en un foro.",
    aula_forum_edit_post: "Edita una publicación tuya.",
    aula_forum_delete_post: "Borra una publicación tuya.",
    aula_assign_submit: "Entrega una tarea: primero te muestra la vista previa.",
    aula_choice_answer: "Responde una elección o te anota en un grupo.",
    aula_send_message: "Manda un mensaje: primero te muestra a quién le llega.",
    aula_calendar_add_event: "Agrega un recordatorio a tu calendario.",
};

/** Escrituras en dos pasos (src/shared/confirmation.ts): primero muestran una vista previa. */
export const CONFIRMED = new Set(["aula_assign_submit", "aula_send_message"]);

/** Actividad de ejemplo de la tarjeta del hero. */
export const FEED = [
    { text: "Revisó qué tenés que entregar esta semana", tool: "aula_list_upcoming", when: "hace 1 min" },
    { text: "Leyó tu historia académica", tool: "guarani_open", when: "hace 4 min" },
    { text: "Resumió la guía de la unidad 3", tool: "aula_read_file", when: "hace 12 min", faded: true },
];

/** Preguntas de ejemplo (las del README) y la tool que las contesta. */
export const ASKS = [
    { q: "¿Qué tengo que entregar esta semana?", tool: "aula_list_upcoming" },
    { q: "¿Cómo voy en Física?", tool: "aula_list_grades" },
    { q: "¿Hay algo nuevo en el aula esta semana?", tool: "aula_list_updates" },
    { q: "¿Me contestó el profe de Álgebra?", tool: "aula_list_messages" },
    { q: "Resumime la guía de la unidad 3 de Sistemas Operativos.", tool: "aula_read_file" },
    { q: "¿Cuándo es el recuperatorio del primer parcial de Álgebra?", tool: "aula_search" },
    { q: "¿Qué finales tengo aprobados y cuál es mi promedio?", tool: "guarani_open" },
    { q: "¿Qué mesas de examen hay para Análisis II?", tool: "guarani_open" },
    { q: "Entregá el TP con el PDF que tengo en Descargas.", tool: "aula_assign_submit" },
];

export const SAFETY = [
    { chip: "Credential Manager", tone: "soft", title: "Contraseñas en el gestor del sistema", text: "Windows Credential Manager, Keychain en macOS o Secret Service en Linux. Solo viajan a tu universidad." },
    { chip: "[DNI]  [email]", tone: "aula", title: "Los datos de otros, tapados", text: "Si en el aula hay una lista de alumnos, el agente solo sabe si figurás. DNI, emails y teléfonos de compañeros llegan tapados." },
    { chip: "vista previa → confirmás", tone: "coral", title: "Escribir pide confirmación", text: "Una entrega o un mensaje primero muestran qué cambia o a quién le llega. Nada se publica si no lo pediste." },
    { chip: "?token=…  ✕", tone: "g3w", title: "Links sin tu token", text: "Los links que te pasa el agente abren con la sesión de tu navegador y nunca llevan tu token." },
];

/** El roadmap en lenguaje de alumno; el técnico está en docs/roadmap.md. */
export const HORIZONS = [
    { label: "Hecho", tone: "done", wide: false, items: [{ title: "Tu aula y tu Guaraní, en el chat", text: "Entregas, notas, avisos, archivos e historia académica, preguntando normal.", tech: "{tools} tools · probado a fondo en UNJu" }] },
    { label: "Ahora", tone: "now", wide: false, items: [{ title: "Usalo sin instalar nada", text: "Conectás tu cliente a un servidor hosteado y entrás con tu usuario del aula. Sin terminal.", tech: "OAuth 2.1 · tu contraseña no se guarda · H1" }] },
    {
        label: "Próximo",
        tone: "next",
        wide: true,
        items: [
            { title: "Que ande en tu facultad", text: "UNSa y UBA probadas con alumnos reales, y el resto con ayuda de la comunidad.", tech: "mismos aciertos que en UNJu · H2 + H4" },
            { title: "Que ande con modelos gratis", text: "Que un modelo chico, de los que no pagás, conteste igual de bien.", tech: "90% de aciertos o más · H3" },
        ],
    },
    {
        label: "Explorando",
        tone: "later",
        wide: true,
        items: [
            { title: "Canvas", text: "Para las facultades que usan Canvas en vez de Moodle.", tech: "un segundo LMS junto a Moodle · sin fecha" },
            { title: "Latinoamérica", text: "Tu aula virtual, estés donde estés. Guaraní es solo de Argentina.", tech: "Moodle o Canvas fuera de Argentina · sin fecha" },
        ],
    },
];

/** Las pestañas de instalación; `{pkg}` es el nombre del paquete en npm. */
export const INSTALL = [
    { id: "desktop", label: "Claude Desktop", file: "extensión .mcpb", code: "1. Bajá unimcp-<versión>.mcpb del último release\n2. Hacele doble click e instalalo\n3. Completá tu campus (ej: unju) y tus usuarios", note: "Claude Desktop guarda las contraseñas de forma segura y trae su propio Node." },
    { id: "code", label: "Claude Code", file: "terminal", code: "npx -y {pkg} login\nclaude mcp add uni -- npx -y {pkg}", note: "El login se hace una sola vez. Para ver si anda todo: npx -y {pkg} check" },
    { id: "codex", label: "Codex", file: "terminal", code: "npx -y {pkg} login\ncodex mcp add uni -- npx -y {pkg}", note: "El login se hace una sola vez." },
    { id: "gemini", label: "Gemini CLI", file: "terminal", code: "npx -y {pkg} login\ngemini mcp add uni npx -y {pkg}", note: "El login se hace una sola vez." },
    { id: "json", label: "Cursor · VS Code", file: "mcp.json", code: '"uni": {\n  "command": "npx",\n  "args": ["-y", "{pkg}"]\n}', note: "En Cursor va en ~/.cursor/mcp.json; en VS Code, en .vscode/mcp.json. Antes corré el login." },
];

export const FAQ = [
    { q: "¿Es oficial?", a: "No. Es un proyecto de estudiantes, de código abierto (MIT), y no está afiliado ni avalado por ninguna universidad ni por el SIU." },
    { q: "¿Necesito saber programar?", a: "No. Con Claude Desktop bajás la extensión .mcpb, le hacés doble click y completás tu campus y tus usuarios. Hay una guía para alumnos en el repo." },
    { q: "¿Dónde quedan mis contraseñas?", a: "En el gestor de credenciales de tu sistema, o en Claude Desktop si usás la extensión. Solo viajan a tu universidad. En modo hosteado la contraseña se usa una vez y no se guarda." },
    { q: "¿El docente ve que lo usé?", a: "Leer no deja rastro: el servidor no llama a las funciones que marcan algo como visto o completo. Lo que escribís (un post, una entrega) queda como si lo hubieras hecho vos." },
    { q: "¿Puede publicar o entregar sin que me dé cuenta?", a: "Las tools que escriben se usan solo si lo pediste. Entregas y mensajes primero muestran una vista previa y esperan tu confirmación. En modo HTTP vienen apagadas." },
    { q: "¿Mi facultad está?", a: "Hay {campus} campus de {universidades}. Si la tuya no está, podés usarla igual con variables de entorno y correr el chequeo para contarnos cómo anduvo." },
    { q: "¿Guaraní anda en el modo hosteado?", a: "Todavía no: su sesión vence en minutos y renovarla necesita la contraseña, que el servidor hosteado no guarda. Instalado en tu compu anda." },
    { q: "¿Qué modelo necesito?", a: "El de tu cliente: Claude, ChatGPT, Gemini o cualquiera que hable MCP. Las tools están pensadas para gastar poco texto por respuesta." },
];
