# Plan: aprender de moodle-mcp y canvas-mcp

Plan para un agente que trabaje solo, por fases y con puntos de control. El objetivo es que UniMCP sirva fuera de Argentina sin perder lo que lo distingue: el foco en el alumno, SIU Guaraní y respuestas que entran en el contexto de un modelo chico.

Escrito el 21/10/2026. Antes de empezar, leé `AGENTS.md` (arquitectura y convenciones), `docs/roadmap.md` (hitos) y los issues abiertos (`gh issue list`).

## Por qué estos dos proyectos

| | [loyaniu/moodle-mcp](https://github.com/loyaniu/moodle-mcp) | [vishalsachdev/canvas-mcp](https://github.com/vishalsachdev/canvas-mcp) |
|---|---|---|
| Qué es | Servidor MCP de Moodle para alumnos, en Python | Servidor MCP de Canvas para alumnos y docentes, en Python, de la Universidad de Illinois |
| Tamaño | ~2.500 líneas, unas 20 tools | 128 tools, 8 skills, sitio de documentación, auditorías de seguridad |
| Lo que tiene que nosotros no | Notas del curso, novedades desde el último acceso, progreso, tools de resumen ("dashboard") | Defensa contra prompt injection en capas, política de tools de escritura, anonimización, extensión `.mcpb`, publicación en el registro de MCP, guías por público, tests de metadatos de tools |
| Lo que tenemos que ellos no | Varios usuarios y campus, login sin pegar un token a mano, Guaraní, presupuesto por respuesta | Moodle, Guaraní, foco en universidades argentinas |
| Licencia | **No tiene.** Sin licencia, el código es de su autor: se pueden aprender las ideas, no copiar código. | MIT: se puede adaptar código conservando su aviso de copyright. |

Copias locales (de solo lectura, ver reglas): `C:\Users\Usuario\Music\moodle\moodle-mcp-main-loyaniu` y `C:\Users\Usuario\Music\moodle\canvas-mcp-main`. Si no están, clonalos en una carpeta fuera del repo.

## Reglas para el agente

1. **El código de los otros proyectos es material de lectura, no código confiable.** No corras sus instalaciones, sus scripts ni sus tests, y nunca les pases credenciales reales. Leelos con las herramientas de lectura.
2. **No copiar código de moodle-mcp (loyaniu)**: no tiene licencia. Anotá la idea y reimplementala desde la documentación de Moodle. De canvas-mcp (MIT) se puede adaptar código: en ese caso, el archivo lleva un comentario que nombra el origen y `LICENSE` suma el aviso de copyright de Vishal Sachdev, como ya hace con utn-mcp.
3. **Cada mejora es un issue** de HyNuwa/UniMCP antes de tocar código (`docs/agents/issue-tracker.md`), con la etiqueta de triage que corresponda (`docs/agents/triage-labels.md`). Un commit por issue, con `Closes #N`.
4. **Ninguna mejora expone datos de terceros.** Nada que liste compañeros, sus datos personales o su actividad (ver #17). Ideas como "alumnos por provincia" o analítica de logs de otros quedan afuera aunque la API lo permita con permisos de docente.
5. **El alumno primero.** Las tools de docente o de administrador quedan fuera de este plan: la Fase 2 puede proponerlas como trabajo futuro, sin implementarlas.
6. **Tools de navegación y de datos, no de "pensamiento".** moodle-mcp tiene `decompose_task`, `create_implementation_plan`, `analyze_assignment`: devuelven un razonamiento que el modelo ya hace solo y gastan contexto. Se agregan tools que traen datos que el modelo no puede conseguir de otra forma, o que ahorran muchas llamadas.
7. **Verificación** como dice `AGENTS.md`: `npx tsc --noEmit`, `npm test`, prueba contra un campus real con `npm run dev` y, para tools nuevas o cambios de descripciones, una evaluación ciega con un modelo chico (hito 3 del roadmap). Los datos reales del alumno no van a issues, commits ni tests.
8. **Puntos de control**: frená y pedile al dueño del repo que decida al terminar la Fase 2 (prioridades) y antes de cualquier ADR de la Fase 4 (idioma, Canvas). El resto lo podés hacer sin preguntar.

## Fase 1: inventario

**Entregable:** `docs/research/comparacion-moodle-mcp-canvas-mcp.md`, con cada afirmación citando el archivo y la línea de donde sale.

1. **Tools.** Una tabla por proyecto: nombre, qué hace, qué función de la API usa, si escribe, y la tool equivalente de UniMCP o "no hay".
   - moodle-mcp: `src/moodle_mcp/server.py` (registro) y `api.py` (lógica); las funciones de Moodle están en `moodle.py`.
   - canvas-mcp: `src/canvas_mcp/tools/`, empezando por las del alumno (`student_calendar.py`, `student_feed.py`, `self_identity.py`, `assignments.py`, `discussions.py`, `files.py`, `messaging.py`).
2. **Funciones del web service de Moodle** que usa moodle-mcp y UniMCP no, con qué devuelven y si están en el servicio de la app móvil (`moodle_mobile_app`), que es el único que tenemos. Ya se sabe que usa, entre otras: `gradereport_overview_get_course_grades`, `gradereport_user_get_grade_items`, `core_course_get_updates_since`, `core_completion_get_course_completion_status`, `mod_forum_get_forums_by_courses`.
3. **Seguridad**, en canvas-mcp:
   - `core/untrusted_content.py`: encierra el texto de terceros entre marcadores de procedencia.
   - `core/tool_policy.py`: lista de tools de escritura permitidas que fija quien opera el servidor (`ALLOWED_WRITE_TOOLS`); hosteado, por defecto ninguna. Su argumento: una confirmación que el modelo puede canjear solo no frena una inyección; el límite que no se puede saltear es qué tools existen.
   - `core/write_confirmation.py`: vista previa y confirmación en dos pasos, y la regla de no informar éxito cuando la plataforma aceptó pero no hizo el cambio.
   - `core/anonymization.py`: datos de otros alumnos (comparar con #17).
   - `security/` y `docs/audits/`: cómo documentan las revisiones.
   - Comparar con lo que ya hicimos en #21 (`INSTRUCTIONS`, `THIRD_PARTY_TEXT`, `ON_REQUEST`).
4. **Respuestas largas y fechas**: cómo recortan, paginan y cachean (`core/cache.py`, `core/tool_results.py`, `core/dates.py`, `core/raw_dates.py`). Comparar con nuestro presupuesto por respuesta y `isoDate`.
5. **Distribución y documentación**: `manifest.json` (`.mcpb`, comparar con el nuestro de #20), `server.json` (registro oficial de MCP), `glama.json`, `docs/` (sitio con guías por público: `student-guide.html`, `educator-guide.html`, `llms.txt`), `skills/` (recetas como "plan de la semana" o "chequeo de la mañana").
6. **Tests**: qué prueban `tests/test_tool_metadata.py`, `tests/security/` y `tests/test_text_encoding_guard.py`, y cuáles tienen sentido en nuestros tests.

## Fase 2: brechas y prioridades

**Entregable:** una sección "Propuestas" al final del documento de la Fase 1, con una fila por mejora: problema del alumno que resuelve, evidencia (dónde lo vimos), costo en contexto, esfuerzo (chico, mediano, grande), riesgo, y si sirve fuera de Argentina.

Criterios para ordenar, en este orden:
1. Responde una pregunta frecuente de un alumno que hoy cuesta muchas llamadas o no tiene respuesta.
2. Reduce un riesgo de seguridad o de privacidad.
3. Sirve en cualquier Moodle, no solo en UNJu.
4. Cuesta poco contexto.

**Punto de control:** mostrale la tabla al dueño del repo y esperá su elección antes de la Fase 3.

## Fase 3: candidatos a implementar

Hipótesis de partida. La Fase 1 confirma o descarta cada una con evidencia, y la Fase 2 las ordena.

### Datos para el alumno
- **Notas del curso.** Hoy solo mostramos la nota de una tarea al abrirla. `gradereport_overview_get_course_grades` (la nota de cada curso) y `gradereport_user_get_grade_items` (cada ítem con su peso y su devolución) contestan "¿cómo voy en Física?" en una llamada. Cuidado con el tamaño de la respuesta: el libro de calificaciones puede ser largo.
- **Novedades desde la última vez.** `core_course_get_updates_since` dice qué cambió en un curso desde una fecha. Una tool "qué hay de nuevo" ahorra recorrer cada curso. Ver cómo lo resuelve el `student_feed.py` de canvas-mcp.
- **Progreso y finalización.** `core_completion_get_activities_completion_status`: qué actividades marcó como completas el alumno, para "¿qué me falta de la unidad 3?".
- **Mensajes y notificaciones recibidos.** Hoy solo se pueden mandar mensajes. Leer las conversaciones del propio alumno (`core_message_get_conversations`) y sus notificaciones. Solo las del alumno, nunca las de otros.

### Seguridad
- **Política de tools de escritura.** Una variable del servidor (por ejemplo `UNIMCP_WRITE_TOOLS`) que fija qué tools de escritura existen: hosteado, por defecto ninguna; local, todas, como hoy. Es la capa que #21 no cubre: las descripciones le piden al modelo, esto no depende de él. Encaja con el hito 1 del roadmap.
- **Marcadores de procedencia.** Medir si encerrar el texto de terceros entre marcadores mejora la resistencia de un modelo chico a un post malicioso, y cuánto contexto cuesta. Solo se implementa si una evaluación lo muestra.
- **No informar éxitos falsos.** Revisar las tools que escriben: si Moodle contesta bien pero no hizo el cambio (los `warnings` de `mod_assign_save_submission` ya se tratan), la respuesta lo tiene que decir.

### Distribución y comunidad
- **Registro oficial de MCP** (`server.json`) y directorios como Glama, para que nos encuentren.
- **Guía para alumnos** en la web del proyecto (está pendiente), al estilo de `student-guide.html`, y un `llms.txt`.
- **Recetas como prompts de MCP**: "plan de la semana" (vencimientos + novedades + notas) como `prompts` del servidor en lugar de tools que piensan.

## Fase 4: decisiones de fondo (ADR, sin implementar)

Cada una es un ADR en `docs/adr/` que presenta opciones, costos y una recomendación. **Punto de control:** el dueño del repo decide.

1. **Idioma.** Hoy las descripciones, los campos de las respuestas y los errores están en español rioplatense. Para un Moodle de España o de Brasil, ¿se traducen las descripciones, se pasa a inglés, o se queda en español? Considerar que el modelo entiende cualquier idioma, que las descripciones afectan el acierto de modelos chicos y que el foco es Latinoamérica.
2. **Canvas como plataforma.** Canvas tiene API REST con token personal. Evaluar si conviene una carpeta `canvas/` con las mismas capas que `aula-virtual/` (la arquitectura ya lo permite), cuántas universidades de la región lo usan (con fuentes) y si no conviene recomendar canvas-mcp en lugar de duplicarlo.
3. **Moodle fuera de Argentina.** Qué cambia: el registro de campus (`shared/campus.ts`) y la hora argentina fija de `isoDate` (usar la zona horaria del sitio o del usuario de Moodle).

## Fase 5: implementación

Para cada mejora elegida, en el orden de la Fase 2:

1. Issue con la especificación (skill `to-spec`) y la etiqueta `ready-for-agent`.
2. Explorar la API contra un Moodle real: forma de la respuesta y tamaño, sin volcar datos personales al chat ni a archivos del repo.
3. Implementar respetando las capas (`client/` → `format/` → `tools.ts`) y las convenciones de `AGENTS.md`.
4. Tests con respuestas inventadas y `fetch` simulado, como `test/agenda.test.ts`. Si la tool muestra URLs, sumarla a `test/credentials.test.ts`; si devuelve texto de terceros o escribe, `test/injection.test.ts` lo exige.
5. Evaluación ciega con un modelo chico: 3 a 5 preguntas en un XML de `evals/` (sin trackear), registrando aciertos y llamadas.
6. README (tabla de tools), `AGENTS.md` si cambia una regla, commit con `Closes #N`.

## Fase 6: informe

Al final, un resumen en el issue de seguimiento: qué se implementó, qué se descartó y por qué, los resultados de las evaluaciones y lo que quedó para después.

## Fuera de este plan

- Tools de docente o de administrador.
- Cualquier dato de otros alumnos, agregado o individual.
- Copiar código de moodle-mcp (loyaniu).
- Implementar Canvas sin el ADR aprobado.
