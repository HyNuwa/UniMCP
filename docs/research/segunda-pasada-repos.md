# Segunda pasada: canvas-mcp, moodle-mcp y mcp-canvas-lms

Escrito el 23/10/2026, para el issue #22. Es la continuación de `comparacion-moodle-mcp-canvas-mcp.md`: aquella buscaba tools para el alumno; esta, cómo están hechos los proyectos por dentro (seguridad, trato con la plataforma, modo hosteado, distribución, documentación) y qué conviene copiar o evitar.

Las citas `archivo:línea` son relativas a cada proyecto. Las copias locales están en `C:\Users\Usuario\Music\moodle`.

| Proyecto | Qué es | Licencia |
|---|---|---|
| **canvas** — [vishalsachdev/canvas-mcp](https://github.com/vishalsachdev/canvas-mcp) v1.14.0 | Canvas para alumnos y docentes, Python | MIT |
| **loyaniu** — [loyaniu/moodle-mcp](https://github.com/loyaniu/moodle-mcp) | Moodle para alumnos, Python | Sin licencia: solo ideas |
| **saad** — [SaadRahman01/moodle-mcp](https://github.com/SaadRahman01/moodle-mcp) | Documentación de Moodle para *desarrolladores* de plugins, Python | MIT (`LICENSE:3`) |
| **canvas-lms** — mcp-canvas-lms v2.3.0 | Canvas con funciones de alumno, docente y administrador, TypeScript | MIT (`package.json`) |

## Lo que confirmó la prueba en Claude Desktop

El 23/10, el dueño del repo le pidió a Claude Desktop "revisá las últimas novedades de mi aula virtual". Con la extensión `.mcpb` instalada, usó `aula_list_updates` y después abrió lo importante.

- **La respuesta fue completa y bien organizada por materia**, con fechas de cierre y avisos.
- **Un aviso con la lista de alumnos que pueden ser dados de baja llegó entero al modelo.** El modelo dijo que el usuario no figuraba. Es el caso del #17: la respuesta fue útil, pero pasaron datos de otros alumnos. Sube la prioridad de #17 antes de probar con más alumnos.

## 1. Trato con la plataforma

| Qué | Dónde | UniMCP hoy |
|---|---|---|
| **Límite de pedidos simultáneos** a la plataforma, con un semáforo | canvas `core/client.py:69-98` | No hay. `aula_list_updates` lanza en paralelo un pedido por curso y hasta 40 por módulo; `aula_search` y `aula_list_grades`, uno o dos por curso. Contra el aula de una universidad, con varios alumnos en el modo hosteado, es un riesgo (el roadmap ya tiene "Hosteado: límites hacia la universidad"). |
| **Reintento ante 429 y respetando `Retry-After`**, con espera exponencial | canvas `core/client.py:625-637`; saad (README, "retry + `Retry-After` header respect") | No hay reintento de lecturas ante 429 o 503. |
| **Reintentar escrituras ante un error de red o un 5xx** (anti-patrón) | canvas-lms `src/client.ts:159-164`: `shouldRetry` vuelve a mandar cualquier pedido, también un POST que publica o entrega | Bien: `callWs` reintenta solo cuando el token venció (`web-service.ts:32-41`), que es cuando Moodle rechazó el pedido sin hacerlo. Conviene dejarlo escrito como regla. |
| **Escritura dudosa**: un timeout o un 5xx puede haber hecho el cambio igual | canvas `core/write_outcome.py:5-10` separa "no se mandó", "rechazado" y "puede haberse escrito", y en ese caso pide revisar antes de reintentar (`security/student-feature-review-2026-10-08.md`) | El error dice "No se pudo conectar con…" (`shared/http.ts`) aunque el POST haya llegado. El modelo puede reintentar y publicar dos veces. |
| **`User-Agent` propio**: `canvas-mcp/{versión} (url del repo)` | canvas `core/client.py:32-38`, que dice que Canvas lo exige desde enero de 2026 | No manda ninguno. Un admin del aula que vea tráfico raro no sabe de dónde sale. |
| **Datos que nunca cambian, pedidos en cada llamada** | — | `getSiteInfo` se pide en cada función del cliente para saber el `userid`. `aula_list_grades` hace unos 20 pedidos con 9 cursos, y casi la mitad son ese. |

## 2. Seguridad y privacidad

- **Revisión de las funciones del alumno** (canvas `security/student-feature-review-2026-10-08.md`):
  - Cachés compartidos entre usuarios en HTTP, que filtraban datos de un curso a otro usuario. En UniMCP no hay estado global por usuario: las únicas variables de módulo son `warned` (`mcp-server.ts`), `pdfjsLoading` y constantes.
  - Errores de la plataforma devueltos sin marcar.
  - Mensajes: máximo 5 destinatarios, sin alias que se expandan, y el usuario tiene que ser parte de la conversación para responder.
  - Documentación que decía que una escritura pedía confirmación cuando no la pedía.
- **Auditoría de prompts** (canvas `docs/audits/2026-09-23-prompt-audit.md`): 74 hallazgos en 103 tools. El problema principal no fue el exceso de instrucciones, sino descripciones que "afirman con seguridad un comportamiento que el código ya no tiene" (`:83`) y 16 parámetros sin descripción.
  - En UniMCP, 3 parámetros no tienen ejemplo: `aula_open.pagina`, `aula_read_file.url` y `aula_read_file.desde`, aunque `AGENTS.md` lo pide.
  - Las descripciones de las 18 tools suman 16.712 caracteres, unos 4–5k tokens, que van en cada conversación.
- **Rutas públicas** (canvas `tests/security/test_public_route_limits.py`): limitar lo que puede hacer alguien sin autenticar.
  - UniMCP ya limita los intentos de login por IP (`oauth/server.ts:96-97`), que es lo que impide usar el servidor para probar contraseñas contra el aula.
- **Datos personales en los logs** (canvas `tests/security/test_pii_sanitization.py`): enmascara campos personales y deja solo los últimos 4 dígitos de los ids.
  - UniMCP escribe en los logs el usuario del aula, que en algunas universidades es el DNI, y el email (`oauth/server.ts:217`, `:278`, `:306`; `oauth/access.ts:57`).
- **Mínimo privilegio en GitHub Actions** (canvas `tests/security/test_workflow_permissions.py`, `.github/dependabot.yml`, `scorecard.yml`).
  - UniMCP: `ci.yml` no declara `permissions` (hereda lo que configure el repo) y no hay Dependabot.
  - El escaneo de secretos y la protección de push ya están activos; las actualizaciones de seguridad de Dependabot, no.
- **Política de seguridad** (canvas `SECURITY.md`): cómo reportar una vulnerabilidad en privado y en cuánto tiempo se responde.
  - UniMCP no tiene `SECURITY.md`, y el reporte privado de vulnerabilidades del repo está apagado. Para un proyecto que maneja contraseñas de alumnos, conviene tenerlo antes de publicar.
- **El docente decide sobre su curso** (canvas `core/course_policy.py:1-30`): el docente puede prohibir que un agente escriba en su curso con una marca en el programa (syllabus), que solo él puede editar.
  - Solo puede restringir lo que el operador permitió, nunca ampliarlo.
  - Una página del curso no sirve como marca: un alumno podría crearla y después bloquearla (`:16-24`).
  - En Moodle, el equivalente sería el resumen del curso.
- **Releer después de editar** (canvas `core/guarded_edit.py:1-25`): una edición se da por hecha solo si al releer el objeto el cambio está.
- **Una falla real en Canvas** (canvas-lms `README.md`, sección de seguridad): el autor encontró que un Canvas exponía datos de otros alumnos y lo reportó. Recuerda que la plataforma puede devolver datos de terceros por error, y que el MCP no tiene que pasarlos.

## 3. Diagnóstico, distribución y documentación

- **Diagnóstico de una línea** (saad, README: `moodle-mcp --check` prueba la conexión y sale).
  - Un `unimcp check` que pruebe el campus, el login del aula y de Guaraní, y qué funciones del web service están habilitadas para cada tool.
  - Es lo que necesita alguien de otra universidad para decirnos si anda sin mandar datos personales (`CONTRIBUTING.md`, plantilla "Probé mi universidad").
- **Notificaciones de progreso** durante las búsquedas de varios pasos (saad, README).
  - `aula_list_updates` y `aula_list_grades` tardan de 1 a 2 s con 9 cursos; con más cursos, el cliente podría mostrar el avance.
- **Publicación en el registro oficial de MCP desde el release** (canvas `.github/workflows/publish-mcp.yml:108-134`): `mcp-publisher login github-oidc`, sin secretos guardados. Con `server.json` es P6 de la primera pasada.
- **Guía para alumnos** (canvas `docs/student-guide.html`).
  - Sus secciones: qué puede hacer, requisitos, instalación, preguntas para empezar, tools por tema, privacidad y seguridad, ejemplos y problemas frecuentes ("no aparecen las tools", "no aparecen mis cursos").
  - Es el esqueleto para la web de UniMCP.
- **Resources de MCP** (canvas `resources/resources.py:16-45`, saad `moodle://docs/...`): el programa del curso o la consigna de una tarea como resource.
  - En UniMCP lo cubre `aula_open`. No aporta mientras los clientes no los usen.
- **Tests de transporte** (canvas-lms `tests/transport.behavior.test.ts`): prueba el servidor de punta a punta por STDIO y HTTP, como hace UniMCP con `InMemoryTransport`.
- **Lo que no conviene copiar:**
  - Clasificar tools de lectura por prefijo del nombre (canvas-lms `src/index.ts:846`), en lugar de anotaciones.
  - Reintentar escrituras (ver arriba).
  - Volcar respuestas a disco (loyaniu, ver la primera pasada).
  - Guías internas genéricas de "cómo usar Claude Code" (canvas `internal/best-practices.md`).

## Propuestas

Ordenadas con los criterios del plan: preguntas frecuentes del alumno, riesgo, que sirva en cualquier Moodle y costo de contexto. Ninguna agrega tools.

| # | Mejora | Por qué | Evidencia | Esfuerzo |
|---|---|---|---|---|
| R1 | **Tope de pedidos simultáneos por sesión** hacia Moodle y Guaraní (por ejemplo 4), y reintento de lecturas ante 429 o 503 respetando `Retry-After`. Las escrituras nunca se reintentan, y queda escrito en `AGENTS.md`. | Cuidar el aula de la universidad, sobre todo en el modo hosteado | canvas `client.py:69-98`, `:625-637`; canvas-lms `client.ts:159-164` como anti-patrón | Chico |
| R2 | **Guardar el `userid` en la sesión** en lugar de pedirlo en cada función | Casi la mitad de pedidos menos en `aula_list_grades` y `aula_list_updates` | — | Chico |
| R3 | **Escritura dudosa**: si un POST que escribe se corta por timeout o vuelve 5xx, el error dice que pudo haberse hecho y que se revise antes de reintentar | Que el modelo no publique ni entregue dos veces | canvas `write_outcome.py` | Chico |
| R4 | **`unimcp check`**: campus, login del aula y de Guaraní, versión de Moodle y qué tools funcionan, sin datos personales, listo para pegar en un issue | Que otras universidades lo prueben y nos avisen | saad `--check` | Mediano |
| R5 | **`User-Agent`**: `unimcp/<versión> (+https://github.com/HyNuwa/UniMCP)` | Que un admin del aula sepa de dónde viene el tráfico | canvas `client.py:32-38` | Chico |
| R6 | **`SECURITY.md`** y activar el reporte privado de vulnerabilidades del repo | Que una falla se reporte en privado y no en un issue público | canvas `SECURITY.md` | Chico; activar el reporte es una configuración del repo que hace el dueño |
| R7 | **Datos personales fuera de los logs**: usuario y email enmascarados | El usuario puede ser el DNI | canvas `test_pii_sanitization.py` | Chico |
| R8 | **CI con mínimo privilegio**: `permissions: contents: read` en `ci.yml`, y Dependabot para npm y Actions | Supply chain | canvas `test_workflow_permissions.py`, `dependabot.yml` | Chico |
| R9 | **Ejemplos en todos los parámetros**, con un test que lo exija | `AGENTS.md` lo pide y 3 no lo cumplen | canvas `prompt-audit.md` | Chico |
| R10 | **Auditoría de las descripciones contra el código**, y medir si se pueden acortar sin perder aciertos | 16,7k caracteres en cada conversación; que no prometan lo que el código no hace | canvas `prompt-audit.md:83` | Mediano, con evaluación |
| R11 | **Notificaciones de progreso** en las tools de varios cursos | Que el cliente muestre el avance en las llamadas largas | saad | Chico |
| R12 | **Publicar en el registro de MCP desde `release.yml`** con OIDC (es P6) | Que nos encuentren | canvas `publish-mcp.yml` | Chico, después de `npm publish` |
| R13 | **Guía para alumnos** con la estructura de la de canvas (es P8) | Instalación y primeras preguntas sin ayuda | canvas `student-guide.html` | Va con la web |
| R14 | **El docente decide sobre su curso**: con una marca en el resumen del curso, UniMCP no escribe ahí | Que las universidades lo acepten | canvas `course_policy.py` | Grande; antes, un ADR |
| R15 | **Releer después de editar o borrar** un post | Confirmar que el cambio está | canvas `guarded_edit.py` | Chico, pero poco frecuente |

**Recomendación:**
- **Primero R1, R2, R3 y R5:** cuidan el aula de la universidad y evitan dobles publicaciones, en un solo bloque chico de `client/` y `shared/http.ts`.
- **Después R6, R7, R8 y R9**, que son de higiene y van antes de publicar.
- **R4** es lo que más ayuda a llegar a otras universidades.
- **#17**, por lo que mostró la prueba en Claude Desktop.
- **R10 y R11** cuando haya tiempo.
- **R12 y R13** van con `npm publish` y la web; **R14** es una decisión para más adelante.
