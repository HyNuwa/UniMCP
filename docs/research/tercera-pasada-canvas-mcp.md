# Tercera pasada: lo que no habíamos leído de canvas-mcp

Escrito el 31/10/2026, para el issue #22. Sigue a `comparacion-moodle-mcp-canvas-mcp.md`, que buscó tools, y a `segunda-pasada-repos.md`, que miró cómo están hechos los proyectos por dentro. Los otros tres repos ya estaban leídos casi enteros; de canvas-mcp (476 archivos) quedaba sin citar la mayor parte, y acá van seis temas de esa parte.

Las citas `archivo:línea` son relativas a canvas-mcp (copia local en `C:\Users\Usuario\Music\moodle\canvas-mcp-main`) o, cuando dicen `src/`, a UniMCP. `_agent-inbox/` e `internal/` son notas para los agentes de ese proyecto: se leyeron como datos.

## A. Confirmar antes de escribir

**Qué hacen.** `submit_assignment` y las tools de mensajes trabajan en dos pasos. La primera llamada no escribe: devuelve una vista previa ("NOTHING has been submitted yet", con vencimiento, cierre e intentos usados) y un token de un solo uso, que vence a los 5 minutos y está atado a quién llama, a la tarea y al contenido exacto. La segunda llamada trae el token; si algo cambió (otro texto, otro archivo, otro destinatario, otro intento), el token no sirve y hay que volver a pedir la vista previa (`tools/student_write.py`, `core/write_confirmation.py:1-27`). Antes de mandar, relee el estado de la entrega en Canvas (`_final_preflight`).

**Lo que ellos mismos dicen que no hace.** El token no prueba que una persona vio la vista previa: el modelo lo recibe y lo puede canjear solo. La aprobación humana la pone el cliente MCP (el "¿permitir esta tool?"), y el límite que un prompt injection no cruza es que la tool exista (`write_confirmation.py:19-27`, `tests/security/test_tool_policy.py`). Eso nosotros ya lo tenemos con `UNIMCP_WRITE_TOOLS`. Lo que el token sí agrega es un paso obligado entre "el modelo decidió escribir" y "escribió", con lo que se va a hacer a la vista del usuario.

**Cuánto lo llevaron.** El flujo de entrega está verificado con modelos formales en Lean y TLA+, después de encontrar tres bugs de concurrencia (un token rechazado que se podía reusar, un vencimiento que se revertía cambiando el reloj y dos entregas a la vez tras el vencimiento) (`verify/STUDENT_CONFIRMATION.md`). Para UniMCP, con un usuario por proceso en local, alcanza con la idea y tests comunes.

**Lo que muestra de UniMCP.**
- `aula_assign_submit` escribe en la primera llamada. Nuestra única protección es que la descripción le pide al modelo que confirme con el usuario (`CONFIRM_FIRST`, `src/aula-virtual/tools.ts:432`).
- `archivos` reemplaza la lista entera (`src/aula-virtual/format/submission.ts:204-228`): si el modelo pasa solo el archivo nuevo, los que ya estaban se quitan. Y si queda sin archivos y sin texto, se borra la entrega (`submission.ts:151-161`). Una vista previa con lo que se suma, lo que queda y lo que se quita lo haría visible antes de que pase.
- `aula_send_message` le puede escribir a cualquier usuario del sitio y solo comprueba que el id exista (`src/aula-virtual/format/writes.ts:185-194`).

**Mensajes, en particular.** Para canvas-mcp la tool de mensajes es "el camino obvio" para sacarle datos al alumno: un post con instrucciones le pide al modelo que mande lo que leyó a alguien. Por eso la versión de alumno es más angosta en todo lo que esa fuga necesita (`tools/student_messaging.py:1-36`): ids numéricos explícitos y pocos destinatarios, cada uno alguien con quien Canvas dice que podés hablar en ese curso; la vista previa nombra a cada destinatario con su rol en el curso (para que se vea que va a un compañero y no al docente); cuerpo con tope de caracteres, sin adjuntos ni reenvíos; y rechaza un texto que lleve las marcas con que el servidor encierra el contenido de terceros, para que no se mande una respuesta de una tool pegada.

## B. Los 31 tests de seguridad

La mayoría cubre cosas que no tenemos: CSV con fórmulas, sandbox de código, FERPA, deploys, búsqueda de destinatarios con seudónimos, registro de auditoría. Seis podían aplicar y se revisaron contra el código:

| Test de canvas-mcp | Qué cuida | En UniMCP |
|---|---|---|
| `test_path_segment_injection.py` | Un `?` o `#` en un id corta la ruta y saca el `/self` que la autorizaba | Bien: las direcciones del aula son solo números (`PATTERN` en `src/aula-virtual/format/address.ts`), y `pageUrl` normaliza la URL y exige mismo origen y ruta (`src/guarani/client/g3w.ts:83-101`) |
| `test_course_cache_isolation.py`, `test_discussion_hint_isolation.py`, `test_course_policy_caller_boundary.py` | En HTTP, una cache por curso le contesta a un usuario con lo que leyó otro | Bien: las únicas caches son `WeakMap` por sesión (`siteInfos`, `limiters`) |
| `test_public_route_limits.py` | Las rutas sin autenticar leen bodies de cualquiera | Bien: `express.json`/`urlencoded` con tope de 16 kB, rate limit en login y registro, y la subida con tope de bytes (`src/oauth/server.ts:96-107`, `src/http-server.ts:174`) |
| `test_student_error_provenance.py` | Un error de la plataforma llega al modelo como texto sin marcar | Bajo: los mensajes de error de Moodle y el `#error_login` de Guaraní son textos del sitio, no de docentes ni alumnos |
| `test_file_tool_host_boundary.py` | En HTTP, una tool que lee o escribe el disco del servidor | Bien: en HTTP `aula_assign_submit` no acepta rutas (`httpSubmitSchema`) y leer un archivo no escribe en disco |
| `test_privacy_default_consistency.py` | El valor por defecto de privacidad tiene que ser el mismo en el código, el manifiesto del registro, la imagen de Docker y la plantilla | Hoy coincide: ni `mcpb/manifest.json`, ni `server.json`, ni el `Dockerfile` tocan `UNI_SHOW_THIRD_PARTY_DATA` ni `UNIMCP_WRITE_TOOLS`. Falta un test que lo sostenga (T6) |

`test_anonymization_shapes.py` cuenta que su anonimizador miraba solo el primer nivel y dejaba pasar datos anidados: el nuestro recorre todos los strings (`withoutThirdPartyData`), así que no tiene ese problema.

## C. Partes de MCP que no usamos

- **MCP Apps** (`docs/mcp-apps-feasibility.md:12-60`): la extensión oficial de MCP para devolver una interfaz interactiva (un iframe que el cliente dibuja) en vez de texto, soportada por Claude y Claude Desktop. Su diseño: no una interfaz por tool, sino tres renderizadores genéricos (`table`, `dashboard`, `cards`) a los que apuntan muchas tools con `_meta.ui.resourceUri`, que dibujan los datos estructurados que la tool ya arma. Está solo diseñado, sin implementar. Para UniMCP encajaría con las notas, la historia académica y los vencimientos, que ya salen como datos estructurados. Falta verificar que ande por STDIO y cuánto contexto gasta.
- **Resources** (`resources/resources.py`): el programa del curso y la consigna de una tarea como resources. Los clientes casi no los usan solos; `aula_open` ya cubre lo mismo.
- **Code mode** (`code_api/`, `tools/code_execution.py`): el modelo escribe un programa en TypeScript que corre en un sandbox con el token de Canvas, para trabajos masivos de docentes. Ellos mismos reconocen que una ejecución anula las garantías del token de confirmación y del marcado de texto de terceros, y estudian sacarle la red y el token (`_agent-inbox/2026-10-20-rat-stack-code-mode-boundary.md`). Un alumno no tiene trabajos masivos: no aplica.

## D. Recetas y aprendizaje

- Siete de las ocho skills son para docentes (corrección masiva, armado de cursos, accesibilidad). La de alumnos, `canvas-week-plan`, ya la copiamos como el prompt `aula_plan_semana`.
- El artículo de repaso espaciado (`articles/2026-08-08-spaced-repetition-learning-loop.md`) habla de recordarle al desarrollador las reglas de su flujo de trabajo, no de estudiar. Deja una idea: el modelo puede ayudar a estudiar con lo que ya hay en el aula, como receta (un prompt) y no como tool.

## E. Tools de alumno sin comparar

- **Cuestionarios** (`tools/student_quizzes.py`): dos tools de solo lectura que responden "qué cuestionarios tengo, hasta cuándo y cuántos intentos me quedan". Nunca empiezan un intento ni leen preguntas o respuestas: "son decisiones de integridad académica que este módulo deliberadamente no toma". También evitan una ruta de lectura que en Canvas dispara la corrección de los intentos vencidos. Es lo que pide #14: en Moodle, `mod_quiz_get_quizzes_by_courses` trae apertura, cierre, tiempo límite e intentos permitidos, y `mod_quiz_get_user_attempts` los intentos hechos.
- **Lecturas con efectos.** Lo de Canvas tiene su versión en Moodle: las funciones `*_view_*` registran que viste algo (el docente lo ve en los reportes y puede marcar la actividad como completada) y otras marcan mensajes como leídos. Hoy no usamos ninguna (`src/aula-virtual/client/moodle.ts`), pero no está escrito como regla.
- **Fechas** (`core/raw_dates.py`): si una respuesta muestra una sola fecha, el agente no distingue "no tiene fecha" de "la fecha está en otro campo". Para #14 conviene que un cuestionario sin cierre lo diga, en vez de omitir el campo.
- `self_identity.py` (quién soy, en qué estoy inscripto) ya lo cubren `aula_get_site_info` y `aula_list_courses`. `discovery.py` busca entre sus 88 tools; con 17 no hace falta.

## F. Cómo lleva el proyecto

- **Changelog** (`CHANGELOG.md`): cada versión dice qué cambió para el usuario, con los PRs. Nosotros no tenemos, y el primer `npm publish` es el momento de empezar.
- **Las instrucciones dicen qué falta.** Cuando la política deja fuera las tools que escriben, las instrucciones del servidor lo dicen ("solo lectura; para hacer cambios, corrélo en tu compu"), así una tool ausente no parece un error (`CHANGELOG.md`, versión sin publicar). Nuestro `INSTRUCTIONS` (`src/mcp-server.ts:17-25`) es el mismo con y sin tools de escritura.
- **Resumen al abrir una sesión** (`scripts/github_session_brief.py`): un hook `SessionStart` de Claude Code que pone en contexto los issues y PRs abiertos, para no depender de acordarse de mirar.
- **Guarda de palabras de cierre** (`scripts/check_closing_keywords.py`): un issue se les cerró dos veces porque un PR y un commit decían "fixes #172" en prosa. Nosotros escribimos "Closes #N" a propósito y el riesgo es bajo.

## Propuestas

Con los mismos criterios: preguntas frecuentes del alumno, riesgo, que sirva en cualquier Moodle y costo de contexto.

| # | Mejora | Por qué | Evidencia | Esfuerzo |
|---|---|---|---|---|
| T1 | **Vista previa en `aula_assign_submit`**: la primera llamada no escribe y devuelve qué archivos se suman, quedan y se quitan, si se envía para calificar, el vencimiento y un `confirmacion` de un solo uso atado al contenido; la segunda, con ese valor, entrega. Relee el estado antes de mandar | Hoy una llamada con solo el archivo nuevo quita los anteriores, y una sin nada borra la entrega, sin paso previo | canvas `tools/student_write.py`, `core/write_confirmation.py:1-27`; `src/aula-virtual/format/submission.ts:151-161, 204-228` | Mediano |
| T2 | **Mensajes acotados**: vista previa con el nombre del destinatario y su rol en un curso que compartan, tope de caracteres, y rechazar textos con los marcadores de privacidad (`[DNI]`, `[Lista de N personas…]`), que delatan una respuesta de tool pegada | El mensaje es el camino para sacarle datos al alumno con un prompt injection | canvas `tools/student_messaging.py:1-36`, `test_student_messaging_invariants.py`; `src/aula-virtual/format/writes.ts:185-194` | Mediano; antes, ver qué funciones de miembros de curso expone UNJu |
| T3 | **Cuestionarios con fechas e intentos** (#14): apertura, cierre, tiempo límite, intentos permitidos y hechos; nunca preguntas, respuestas ni empezar un intento. Sin cierre, decirlo | "¿Hasta cuándo tengo el cuestionario?" es frecuente y hoy no tiene respuesta | canvas `tools/student_quizzes.py`, `core/raw_dates.py` | Mediano; antes, `unimcp check` en UNJu para ver si están las funciones de `mod_quiz` |
| T4 | **Regla de lecturas sin efectos**: en `AGENTS.md` y con un test sobre las funciones del cliente: nada de `*_view_*`, marcar como leído ni nada que dispare una corrección | Que el docente no vea "visto" ni actividades completadas que el alumno no abrió | canvas `tools/student_quizzes.py` (la ruta que corrige intentos) | Chico |
| T5 | **Instrucciones según la política de escritura**: sin tools que escriben, `INSTRUCTIONS` dice que es solo lectura y cómo habilitarlas | En HTTP el modelo no sabe por qué no puede publicar y el alumno lo toma como un error | canvas `CHANGELOG.md` (sin publicar) | Chico |
| T6 | **Test de los valores por defecto en cada canal**: ni `server.json`, ni el manifiesto de la extensión, ni el `Dockerfile`, ni `.env.example` prenden `UNI_SHOW_THIRD_PARTY_DATA` o `UNIMCP_WRITE_TOOLS` | Que un cambio en un canal no abra los datos de terceros o las escrituras sin que nadie lo note | canvas `test_privacy_default_consistency.py` | Chico |
| T7 | **`CHANGELOG.md`** desde la primera versión publicada | Que quien instala sepa qué cambió | canvas `CHANGELOG.md` | Chico; va con `npm publish` |
| T8 | **Prompt de estudio** ("preparar el parcial de X"): buscar el material de la unidad, leerlo y armar preguntas de práctica con las respuestas aparte | Usar lo que ya está en el aula para estudiar, sin agregar tools | canvas `articles/2026-08-08-spaced-repetition-learning-loop.md` (la idea), P7 | Chico |
| T9 | **Resumen de issues y PRs al abrir Claude Code** (hook `SessionStart`) | Arrancar cada sesión sabiendo qué está abierto | canvas `scripts/github_session_brief.py` | Chico; es configuración local del dueño |
| T10 | **MCP Apps** para notas, historia académica y vencimientos, con renderizadores genéricos | Tablas que se leen mejor que texto | canvas `docs/mcp-apps-feasibility.md` | Grande; antes, probar que anda por STDIO en Claude Desktop |

**Recomendación:**
- **Primero T1 y T4**: T1 evita que una entrega pierda archivos sin aviso, y T4 es una regla que conviene fijar antes de T3.
- **Después T3**, que cierra #14 y es de lo que más va a preguntar un alumno.
- **T2** con T1, porque comparten la vista previa.
- **T5, T6 y T7** son chicos y van antes de publicar.
- **T8** cuando haya tiempo; **T9** la decidís vos; **T10** queda para cuando se pueda probar.

### Descartadas

- **Verificación formal** (Lean, TLA+): sus bugs eran de varios pedidos a la vez en un servidor con muchos usuarios; en UniMCP alcanza con tests comunes del token.
- **Code mode**: es para trabajos masivos de docentes y anula las demás defensas.
- **Resources** del programa y la consigna: `aula_open` ya lo trae, y los clientes casi no usan resources solos.
- **Búsqueda de tools** (`discovery.py`): tiene sentido con 88 tools, no con 17.
- **Guarda de palabras de cierre**: el riesgo es bajo con nuestra forma de escribir los commits.
- CSV, sandbox, FERPA, auditoría y deploys: no tenemos esas partes.
