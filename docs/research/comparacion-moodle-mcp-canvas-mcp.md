# Comparación con moodle-mcp y canvas-mcp

Fases 1 y 2 de `docs/plans/aprender-de-moodle-mcp-y-canvas-mcp.md` (issue #22). Escrito el 23/10/2026.

Las citas `archivo:línea` son relativas a cada proyecto:
- **loyaniu** es [loyaniu/moodle-mcp](https://github.com/loyaniu/moodle-mcp). No tiene licencia, así que solo se toman ideas.
- **canvas** es [vishalsachdev/canvas-mcp](https://github.com/vishalsachdev/canvas-mcp), v1.14.0, con licencia MIT (`LICENSE:3`).

Los datos de UNJu salen de pruebas contra el aula real (Moodle 3.9.25, 387 funciones en el servicio de la app). Solo se midieron nombres de campos, cantidades y tamaños, sin guardar contenido.

## 1. Tools

### moodle-mcp (loyaniu)

Las 24 tools se registran en `src/moodle_mcp/server.py:9-150` y su lógica está en `api.py`. Todas son de lectura.

| Tool | Qué hace | Función de Moodle | Equivalente en UniMCP |
|---|---|---|---|
| `get_upcoming_events` | Eventos próximos | `core_calendar_get_calendar_upcoming_view` (`api.py:349`) | `aula_list_upcoming` |
| `get_my_courses` | Cursos del usuario | `core_enrol_get_users_courses` (`api.py:382`) | `aula_list_courses` |
| `get_course_content` | Secciones y módulos | `core_course_get_contents` (`api.py:414`) | `aula_open` de un curso |
| `get_assignments` | Tareas de varios cursos | `mod_assign_get_assignments` (`api.py:449`) | Parcial: `aula_list_upcoming` (las pendientes) y `aula_open` |
| `get_assignment_status` | Estado de la entrega y nota | `mod_assign_get_submission_status` (`api.py:490`) | `aula_open` de la tarea |
| `get_upcoming_deadlines`, `get_overdue_assignments`, `get_actionable_tasks` | Vencimientos, vencidas sin entregar, tareas por urgencia | Las de tareas, combinadas (`api.py:520`, `:840`, `:758`) | `aula_list_upcoming`, con `vencida` y `disponible` |
| `get_grades` | Nota de cada curso, o los ítems de uno | `gradereport_overview_get_course_grades`, `gradereport_user_get_grade_items` (`api.py:566-640`) | **No hay**: solo la nota de una tarea al abrirla |
| `search_course_materials` | Busca en nombres de secciones, actividades y archivos, del lado del cliente (`api.py:643-684`) | `core_course_get_contents` por curso | `aula_search` |
| `get_recent_activity` | Novedades desde una fecha | `core_course_get_updates_since`, una llamada por curso (`api.py:886-950`) | **No hay** |
| `get_course_announcements` | Avisos de los foros de novedades | `mod_forum_get_forums_by_courses` y `mod_forum_get_discussions` (`api.py:959-1040`) | `aula_open` del foro de avisos, curso por curso |
| `get_course_progress`, `get_course_health` | Porcentaje de finalización | `core_completion_get_course_completion_status` (`api.py:1123-1190`) | **No hay** |
| `semester_dashboard`, `daily_briefing`, `weekly_review`, `get_study_load` | Resúmenes que combinan las anteriores (`api.py:691`, `:1262`, `:1339`, `:1194`) | Las mismas | No hay. Son candidatas a prompts de MCP (ver P7) |
| `ask_moodle` | Elige qué consultar según palabras clave de la pregunta (`api.py:1426-1460`) | Las mismas | No. Elegir la tool es trabajo del modelo |
| `analyze_assignment`, `extract_assignment_requirements`, `find_relevant_materials`, `decompose_task`, `create_implementation_plan` | Arman "requisitos", subtareas y planes con heurísticas y palabras clave (`api.py:1557-1600`, `:1946`, `:2103`) | Las de tareas | No. Son tools de "pensamiento" (regla 6 del plan) |

Otras cosas que se ven en el código:
- **Vuelca cada respuesta cruda de Moodle a disco.** `to_json_file` escribe en `output/` notas, foros, cursos y estados de entrega (`utils.py:9-14`, llamado en `api.py:352`, `:389`, `:579`, `:609` y más), sin opción para apagarlo. UniMCP no persiste respuestas, y hay que mantenerlo así.
- **Manda el token en la URL.** Usa `requests.get` con `wstoken` en el query string (`moodle.py:248-262`), así que el token puede quedar en logs de proxies. UniMCP lo manda en el cuerpo de un POST.
- **Lee mal `core_course_get_updates_since`.** Usa `component`, `name` y `timecreated` (`api.py:910-913`), pero la respuesta trae `instances[{contextlevel, id, updates[]}]`, como confirmó UNJu. Esas novedades le quedan sin nombre ni fecha.
- **Fechas en UTC** (`api.py:913`). UniMCP usa la hora argentina (`isoDate`).
- Un solo usuario, con un token que se pega a mano en `.env` (`moodle.py:163-164`).

### canvas-mcp

Tiene unas 128 tools en `src/canvas_mcp/tools/`, que suman 21.474 líneas. Muchas son de docente o de administrador y quedan fuera de este plan (regla 5). Estas son las del alumno:

| Tool | Archivo | Escribe | Equivalente en UniMCP |
|---|---|---|---|
| `get_my_upcoming_assignments`, `get_my_todo_items` | `student_tools.py:132`, `:398` | No | `aula_list_upcoming` |
| `list_calendar_events`, `get_calendar_event` | `student_calendar.py:699`, `:819` | No | `aula_list_upcoming` (los `eventos`) |
| `get_my_submission_status`, `get_my_submission` | `student_tools.py:220`, `student_write.py:585` | No | `aula_open` de la tarea |
| `get_my_course_grades`, `get_my_assignment_scores` | `student_tools.py:344`, `student_grades.py:788` | No | **No hay** |
| `calculate_grade_scenarios`: recalcula la nota del curso, prueba notas hipotéticas y dice cuánto hace falta en lo que queda | `student_grades.py:808-830` | No | No hay (ver lo descartado) |
| `list_my_announcements`, `get_my_activity_stream`: avisos y novedades de todos los cursos en una llamada | `student_feed.py:1-24`, `:618`, `:816` | No | **No hay** |
| `list_conversations`, `get_conversation_details`, `get_unread_count` | `messaging.py:308`, `:408`, `:460` | No | **No hay**: solo se pueden mandar mensajes |
| `find_message_recipients`, `send_message`, `reply_to_conversation` | `student_messaging.py:523`, `:645`, `:815` | Sí | `aula_send_message` |
| `submit_assignment`, `comment_on_my_submission` | `student_write.py:655`, `:914` | Sí | `aula_assign_submit` |
| `mark_module_item_done` | `student_write.py:966` | Sí | No hay. En Moodle sería `core_completion_update_activity_completion_status_manually` |
| `list_planner_notes` y crear, editar y borrar notas, `create_personal_calendar_event` y `delete_personal_calendar_event` | `student_calendar.py:864-1484` | Sí | `aula_calendar_add_event` (solo crea) |
| `list_quizzes`, `get_quiz_details` (nunca empiezan un intento) | `student_quizzes.py:597`, `:719` | No | `aula_open` del cuestionario, genérico |
| `list_my_groups`, `get_group_members`, `list_group_files` | `student_groups.py:224`, `:307`, `:352` | No | No hay. Los miembros de un grupo son datos de terceros (regla 4) |
| `get_my_enrollments`, `get_my_profile` | `self_identity.py:48`, `:117` | No | `aula_list_courses`, `aula_get_site_info` |
| `search_canvas_tools`: busca entre sus propias tools | `discovery.py:91` | No | No hace falta con 16 tools |

**Las tools de escritura del alumno están apagadas por defecto**, también en local. Se prenden una por una con `STUDENT_WRITE_TOOLS`, y después rige `ALLOWED_WRITE_TOOLS` (`README.md:158`). En UniMCP, las 7 tools de escritura del aula están siempre, tanto en STDIO como en HTTP.

## 2. Funciones de Moodle que UniMCP no usa

Todas estas están en el servicio de la app móvil de UNJu (`core_webservice_get_site_info.functions`). Los tamaños son de las respuestas crudas, antes de recortar campos, para una cuenta de alumno con 9 cursos.

| Función | Qué devuelve | En UNJu |
|---|---|---|
| `gradereport_overview_get_course_grades` | `grades[{courseid, grade, rawgrade}]`: la nota de cada curso | 342 caracteres para todos los cursos. Trae 7 de los 9. |
| `gradereport_user_get_grade_items` | Cada ítem con `itemname`, `gradeformatted`, `grademin`, `grademax`, `percentageformatted`, `feedback`, `gradeishidden`, `cmid` y más | De 3 a 16 ítems por curso, 1,7k a 8,6k caracteres. **En 2 de 9 cursos responde `nopermissiontoviewgrades`**, porque el docente oculta el libro de calificaciones. |
| `core_course_get_updates_since` | `instances[{contextlevel, id, updates[{name, timeupdated, itemids}]}]`: qué módulos (`id` = cmid) cambiaron y en qué | Con 14 días: de 7 a 13 módulos por curso activo, 1–2k caracteres, y vacío en los cursos viejos. No trae nombres: se cruzan con el contenido del curso. |
| `core_completion_get_activities_completion_status` | `statuses[]` de cada actividad | Solo 1 de 9 cursos sigue la finalización (129 actividades, 16,7k). |
| `core_message_get_conversations` | Conversaciones con miembros, último mensaje y `unreadcount` | 20 conversaciones, 25,6k crudo. Los nombres de los miembros son de quienes hablaron con el alumno. |
| `message_popup_get_popup_notifications` | Notificaciones | 0 en la cuenta probada. |
| `mod_forum_get_forums_by_courses` | Los foros de varios cursos, con su `type` (`news` = avisos) | Disponible |
| `core_course_check_updates`, `core_course_get_recent_courses`, `mod_quiz_get_user_attempts`, `core_completion_update_activity_completion_status_manually` | — | Disponibles; no se midieron |

`core_grades_get_gradeitems` no está en UNJu (es de versiones posteriores a la 3.9).

## 3. Seguridad en canvas-mcp

- **Marcadores de procedencia** (`core/untrusted_content.py`)
  - El texto de terceros se encierra entre `<<<UNTRUSTED CANVAS CONTENT` y `<<<END UNTRUSTED CANVAS CONTENT>>>` (`:183-186`, `fence_untrusted` en `:301`). Si un texto trae sus propios marcadores, se neutralizan (`:232-282`).
  - El módulo mismo dice que no impide la inyección: hace visible el límite de confianza (`:10-13`).
  - **Cada tool de lectura está clasificada** como `fenced`, `safe` o `deferred` en un registro, y CI lo compara con las tools registradas (`:62-70`). Una tool nueva no entra sin decidir.
  - UniMCP hace algo parecido con `THIRD_PARTY_TEXT`, pero la lista de tools de `test/injection.test.ts` está escrita a mano: una tool de lectura nueva que devuelva texto de terceros puede no figurar.
- **Política de tools de escritura** (`core/tool_policy.py`)
  - Es una lista que fija quien opera el servidor (`ALLOWED_WRITE_TOOLS`). Sin definir, en HTTP no hay ninguna tool de escritura, y en STDIO están todas (`:1-33`, `resolve_tool_policy` en `:216`).
  - Las tools que no están permitidas se sacan del registro: no se listan ni se pueden llamar.
  - El argumento es que una confirmación con token no frena una inyección, porque el modelo recibe el token y lo puede canjear solo. Lo explican en `:3-10` y `core/write_confirmation.py:19-26`, y salió de un aviso de seguridad, GHSA-hmr8-mvr2-mvw5 (`README.md:169`).
- **No informar éxitos falsos.** Canvas a veces contesta 200 sin hacer el cambio, así que la regla es no informar éxito de algo que el usuario no ve en Canvas (`write_confirmation.py:1-9`). `write_outcome.py:5-10` además separa "no se mandó", "rechazado" y "puede haberse escrito" (timeouts, 5xx), para no reintentar algo que quizá ya se publicó.
  - En UniMCP, `callWs` reintenta solo si Moodle rechazó el token (`web-service.ts:32-41`), así que no hay riesgo de publicar dos veces. Falta revisar que cada tool que escribe muestre los `warnings` de Moodle.
- **Anonimización** (`core/anonymization.py`): reemplaza los datos de alumnos en las respuestas para docentes (FERPA). El caso del alumno es distinto, y en UniMCP es el #17 (datos de terceros en avisos y etiquetas).
- **Tests de metadatos** (`tests/test_tool_metadata.py:1-16`): toda tool declara `readOnlyHint`, o `destructiveHint` e `idempotentHint` si escribe, y el test recorre el registro real.
  - UniMCP declara las anotaciones en todas sus tools (`src/aula-virtual/tools.ts:33`, `:332-606`), pero ningún test lo exige.
- **`tests/test_text_encoding_guard.py`** prohíbe abrir archivos sin `encoding` en Python. No aplica a Node.

## 4. Respuestas largas y fechas

- **Tamaño.** canvas-mcp no recorta por presupuesto. Hace al revés: pide que el cliente no corte, declarando `anthropic/maxResultSizeChars` = 500.000 en las tools que devuelven contenido completo (`core/tool_results.py:15-28`). UniMCP recorta a 30.000 caracteres y dice cómo seguir, que va mejor con modelos chicos. No hace falta cambiarlo.
- **Fechas.** canvas-mcp usa ISO 8601 en la zona que se configure con `TIMEZONE`, UTC por defecto (`core/dates.py:1-14`). UniMCP fija `-03:00`, que es lo que habría que cambiar para servir fuera de Argentina (ADR 3 de la Fase 4).

## 5. Distribución y documentación

- **`.mcpb`.** El `manifest.json` de canvas-mcp usa `manifest_version` 0.2 y pide la URL y el token. El nuestro (#20) usa 0.3 y pide campus, usuarios y contraseñas.
- **Registro oficial de MCP.** canvas-mcp tiene un `server.json` con el esquema `2025-12-11`, el nombre `io.github.vishalsachdev/canvas-mcp` y el paquete de PyPI. UniMCP necesita lo mismo con el paquete de npm, después de `npm publish`.
- **Glama.** `glama.json` es solo `{"$schema", "maintainers"}`.
- **Sitio.** Tiene guías por público (`docs/student-guide.html`, `educator-guide.html`) y un `docs/llms.txt` que resume el proyecto y enlaza las guías.
- **Skills.** `skills/canvas-week-plan/SKILL.md` es una receta que encadena tools: vencimientos de 7 días, después estado de entrega, después notas. Es lo que en UniMCP podría ser un prompt de MCP.

## 6. Tests de canvas-mcp que tienen sentido acá

- Clasificar toda tool de lectura como "devuelve texto de terceros" o no, recorriendo el registro real: amplía `test/injection.test.ts`.
- Que toda tool declare sus anotaciones, recorriendo el registro real.
- Que la política de escritura saque las tools del registro (si se hace P2).

## Propuestas (Fase 2)

Ordenadas con los criterios del plan:
1. Responde una pregunta frecuente del alumno.
2. Reduce un riesgo.
3. Sirve en cualquier Moodle.
4. Cuesta poco contexto.

Todas sirven fuera de Argentina, salvo donde se indica.

| # | Mejora | Problema del alumno | Evidencia | Contexto | Esfuerzo | Riesgo |
|---|---|---|---|---|---|---|
| P1 | **Notas** (`aula_list_grades`): sin `curso`, la nota de cada curso; con `curso`, los ítems con nota, rango y devolución | "¿Cómo voy en Física?" hoy obliga a abrir tarea por tarea y no ve los parciales cargados a mano | loyaniu `api.py:566-640`, canvas `student_tools.py:344`, UNJu §2 | ~0,5k todos los cursos; ~1–2k un curso recortado | Mediano | Bajo. La devolución es texto del docente (`THIRD_PARTY_TEXT`). Cuando el docente oculta las notas, decirlo, no fallar. |
| P2 | **Política de tools de escritura** (`UNIMCP_WRITE_TOOLS`): hosteado, ninguna por defecto; local, todas, como hoy | Que un post malicioso no pueda hacer que el modelo publique o mande mensajes en nombre del alumno en el modo hosteado | canvas `tool_policy.py:1-33`, GHSA-hmr8 | 0 | Chico | Quien use el modo hosteado para escribir tiene que prenderlas. Encaja con el hito 1 del roadmap. |
| P3 | **Novedades** (`aula_list_updates`): qué cambió en cada curso desde tu último acceso o una fecha, con el nombre y la `direccion` del módulo | "¿Hay algo nuevo en el aula?" hoy obliga a recorrer cada curso | loyaniu `api.py:886-950` (con el error de campos), canvas `student_feed.py`, UNJu §2 | ~1–3k | Mediano: una llamada por curso más el contenido para los nombres | Bajo |
| P4 | **Tests de metadatos**: toda tool clasificada (texto de terceros sí o no) y con anotaciones | Que una tool nueva no salga sin la defensa de #21 | canvas `untrusted_content.py:62-70`, `test_tool_metadata.py` | 0 | Chico | Ninguno |
| P5 | **Mensajes recibidos** (`aula_list_messages`): conversaciones con el último mensaje y si hay sin leer; al abrir una, sus mensajes | "¿Me contestó el profe?" hoy no tiene respuesta: solo se puede mandar | canvas `messaging.py:308-460`, UNJu §2 | ~3k recortado (crudo 25,6k) | Mediano | Medio: texto de terceros que pide cosas. Solo las conversaciones propias. |
| P6 | **Registro oficial de MCP y Glama** (`server.json`, `glama.json`) | Que lo encuentren | canvas `server.json`, `glama.json` | 0 | Chico, después de `npm publish` | Ninguno |
| P7 | **Prompts de MCP** ("plan de la semana": vencimientos, novedades y notas) | Una receta lista en vez de explicarle al modelo qué encadenar | canvas `skills/canvas-week-plan`, loyaniu `weekly_review` | 0 hasta usarlo | Chico, después de P1 y P3 | Ninguno |
| P8 | **Guía para alumnos y `llms.txt`** en la web del proyecto | Que un alumno sin experiencia lo pueda instalar y sepa qué preguntar | canvas `docs/student-guide.html`, `docs/llms.txt` | 0 | Chico; va con la landing | Ninguno |
| P9 | **Revisar los `warnings` de Moodle** en cada tool que escribe | Que nunca diga "listo" si Moodle no hizo el cambio | canvas `write_confirmation.py:1-9` | 0 | Chico | Ninguno |
| P10 | **Marcadores de procedencia**, solo si una evaluación muestra que ayudan a un modelo chico | Resistencia a posts maliciosos | canvas `untrusted_content.py` | ~60 caracteres por texto | Mediano (evaluación incluida) | Gasta contexto en cada respuesta |

**Recomendación:** P2 y P4 primero, porque son chicas y cierran #21; después P1, P3, P5 y P7. P6 y P8 van con la publicación y la web, P9 se hace de paso, y P10 queda para más adelante.

### Descartadas

- **Finalización de actividades** (`core_completion_*`): en UNJu la usa 1 curso de 9, con 16,7k crudo. Se reconsidera si otro campus la usa.
- **Escenarios de nota** (`calculate_grade_scenarios`): reproducir el cálculo de Moodle (categorías, agregaciones, ítems que se descartan) es grande y frágil, y `gradereport_user_get_grade_items` ya trae el total del curso. El modelo puede hacer la cuenta con los ítems de P1.
- **Tools de "pensamiento" y de resumen** (`decompose_task`, `create_implementation_plan`, `ask_moodle`, `daily_briefing`): regla 6. Los resúmenes van como prompts (P7).
- **Marcar actividades como hechas, notas del planificador, grupos y sus miembros**: lo primero depende de la finalización, que casi no se usa; lo último es dato de terceros (regla 4).
- **Notificaciones** (`message_popup_get_popup_notifications`): 0 en la cuenta probada. Se reconsidera con otro campus.
- **Volcar respuestas a disco** y **el token en la URL**, como hace loyaniu: son cosas a no hacer.
