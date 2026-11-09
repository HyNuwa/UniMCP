# Cambios

Lo que cambia en cada versión para quien usa UniMCP. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

- La extensión de Claude Desktop se descarga directo desde la web y el README, con un link fijo al último release (`unimcp.mcpb`), sin buscar el archivo en la página del release.

## [0.2.0] - 2026-11-08

- 87 aulas nuevas, y ahora hay al menos una en cada provincia: UNC (FAMAF), UNR, UNL, UNLP, UNSAM, UNMdP, UNLu, UNVM, UADER, UNaM, UNaF, UNCA, UNLaR, UNSE, UNPAZ, UNAHUR, 20 regionales más de la UTN, más facultades de la UBA, la UNT, la UNSa y la UNICEN, y UNS, UNNE, UNER, UNCuyo, UNSJ, UNSL, UNLPam, UNCo, UNPSJB y UNTDF. Son 99 campus de 32 universidades.
- `unimcp login` busca tu campus por sigla, facultad o provincia, sin tildes ni mayúsculas, en vez de mostrar la lista entera. Si no está, te dice dónde pedirlo: el formulario "Pedir mi universidad".
- Si en `unimcp login` te equivocás de contraseña (del aula o de Guaraní), te avisa y te la vuelve a pedir, hasta 3 veces, en vez de cortar y obligarte a empezar de nuevo.
- `unimcp check` termina diciendo dónde pegar el resumen para aparecer en el mapa de la web, en el pin de tu campus.

## [0.1.0] - 2026-10-31

La primera versión publicada en npm y en el registro de MCP.

### Aula virtual (Moodle)
- Navegar el aula con `aula_open`: cursos, secciones, módulos, foros y discusiones. Un curso grande llega como índice, y lo que se recorta se avisa con cómo verlo.
- Buscar palabras en uno o en todos los cursos (`aula_search`), y leer archivos por partes (`aula_read_file`), incluidos PDF.
- Lo que viene (`aula_list_upcoming`), las notas con la devolución del docente (`aula_list_grades`), lo nuevo de los últimos días (`aula_list_updates`) y los mensajes recibidos (`aula_list_messages`).
- Los cuestionarios traen si están abiertos o cerrados, sus fechas, el límite de tiempo y los intentos que quedan. Nunca se leen preguntas ni respuestas.
- Escribir solo cuando lo pedís: publicar en foros, editar y borrar tus publicaciones, entregar tareas, responder elecciones, mandar mensajes y agregar recordatorios al calendario.
- Entregar una tarea y mandar un mensaje van en dos pasos: primero una vista previa (qué archivos se suman, cuáles quedan y cuáles se quitan; a quién le llega el mensaje y con qué rol) y después la confirmación.
- El prompt "Plan de la semana": vencimientos, novedades y cómo vas en cada materia.
- Avisos de progreso en las tools que recorren todos los cursos.

### SIU Guaraní
- `guarani_menu` y `guarani_open`: las operaciones que habilitó tu universidad, con la historia académica por materia (con las regularidades vencidas) y la oferta de comisiones por período, filtrables por materia. Solo lectura.

### Privacidad y seguridad
- Lo que escriben docentes y compañeros se trata como datos, nunca como instrucciones para el agente.
- Las listas de alumnos de otros llegan resumidas ("figurás" o "no figurás") y los DNI, emails y teléfonos de otras personas, tapados.
- En modo HTTP, por defecto, no hay tools que escriben, y el servidor se lo dice al agente. Las que existen las elige quien opera el servidor (`UNIMCP_WRITE_TOOLS`).
- Leer no deja rastro en el aula: no se marca nada como visto ni como leído.
- Si una escritura se cortó sin respuesta, el error dice que la revises en el aula antes de reintentar.
- Los links que te pasa el agente nunca llevan tu token, y los logs no llevan tu usuario ni tu email.

### Instalación
- Extensión de Claude Desktop (`.mcpb`) en cada release, o `npx @nuwujix/unimcp` con cualquier cliente MCP.
- `unimcp login` para elegir el campus y guardar las credenciales en el gestor del sistema, y `unimcp check` para probar el campus sin mostrar datos personales.
- Modo HTTP multiusuario con OAuth, donde la contraseña del aula se usa una vez y no se guarda.
- Doce campus de UNJu, UNSa, UNT, UBA y UTN, y cualquier otro por variables de entorno.

[Sin publicar]: https://github.com/HyNuwa/UniMCP/compare/v0.2.0...master
[0.2.0]: https://github.com/HyNuwa/UniMCP/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/HyNuwa/UniMCP/releases/tag/v0.1.0
