# UniMCP: el puente entre tu agente y los sistemas de tu universidad
Este es un Model Context Protocol server **NO OFICIAL** para universidades argentinas. Con él podés pedirle a tu agente (Claude, ChatGPT, etc.) que lea los apuntes del **aula virtual (Moodle)** y consulte tu **SIU Guaraní** y, con tu confirmación, que publique en los foros o entregue tareas. Corre en tu computadora o como servidor HTTP con OAuth.

## Qué podés pedirle
- *"¿Cuándo es el recuperatorio del primer parcial de Álgebra?"*
- *"¿Qué avisó la profesora de Física esta semana?"*
- *"Resumime la guía de la unidad 3 de Sistemas Operativos."*
- *"¿Qué tengo que entregar esta semana?"*
- *"¿Qué nota me pusieron en el TP1 y qué me corrigieron?"*
- *"¿Qué finales tengo aprobados y cuál es mi promedio?"* (Guaraní)
- *"¿En qué materias estoy inscripto este cuatrimestre?"* (Guaraní)
- *"¿Qué mesas de examen hay para Análisis II?"* (Guaraní)

## Universidades y campus
| Id | Universidad | Campus | Aula (Moodle) | Guaraní |
|---|---|---|---|---|
| `unju` | UNJu | Universidad Nacional de Jujuy | `virtual.unju.edu.ar` | `alumnos.unju.edu.ar` |
| `unsa-exactas` | UNSa | Facultad de Ciencias Exactas | `exavirtual.unsa.edu.ar` | `autogestiong3.unsa.edu.ar` |
| `unsa-salud` | UNSa | Facultad de Ciencias de la Salud | `saludvirtual.unsa.edu.ar` | `autogestiong3.unsa.edu.ar` |
| `unsa` | UNSa | Otras facultades | — | `autogestiong3.unsa.edu.ar` |
| `unt-facet` | UNT | FACET | `facetvirtual.facet.unt.edu.ar` | `guarani.unt.edu.ar` |
| `unt-face` | UNT | Ciencias Económicas | `campus2.unt.edu.ar` | `guarani.unt.edu.ar` |
| `unt-filo` | UNT | Filosofía y Letras | `campus.filo.unt.edu.ar` | `guarani.unt.edu.ar` |
| `unt` | UNT | Otras facultades | — | `guarani.unt.edu.ar` |
| `uba-fiuba` | UBA | Ingeniería (FIUBA) | `campusgrado.fi.uba.ar` | `guaraniautogestion.fi.uba.ar` |
| `uba-exactas` | UBA | Ciencias Exactas y Naturales | `campus.exactas.uba.ar` (SSO idEx) | `inscripciones.exactas.uba.ar` |
| `utn-frba` | UTN | Regional Buenos Aires | `aulasvirtuales.frba.utn.edu.ar` (SSO) | — |
| `utn-frt` | UTN | Regional Tucumán | `frt.cvg.utn.edu.ar` | — |

Cada aula se verificó con `tool_mobile_get_public_config` (el servicio móvil de Moodle tiene que estar habilitado) y cada Guaraní con su página de login de autogestión. Probado a fondo solo en **UNJu**; los demás **faltan probarlos con usuarios reales**. Si sos de otra universidad, probalo y contanos cómo te fue con la plantilla [Probé mi universidad](https://github.com/HyNuwa/UniMCP/issues/new?template=probe-mi-universidad.yml), aunque haya andado todo bien. Más formas de colaborar en [CONTRIBUTING.md](CONTRIBUTING.md).

### Sumar tu campus
Si el tuyo no está, podés usarlo igual con variables de entorno (o un `.env`, ver [`.env.example`](.env.example)):
```bash
UNI_AULA_BASE_URL=https://virtual.tu-universidad.edu.ar
UNI_GUARANI_URL=https://autogestion.tu-universidad.edu.ar/autogestion
# UNI_SSO_HOST=sso.tu-universidad.edu.ar   # solo si el aula entra por Keycloak
```
y en el login elegís `personalizado`. Para sumarlo para todos, agregá una entrada en `CAMPUSES` de `src/shared/campus.ts`. Para saber si un Moodle sirve:
```bash
curl -s -X POST "https://TU-AULA/lib/ajax/service-nologin.php?info=tool_mobile_get_public_config" \
  -H 'content-type: application/json' -d '[{"index":0,"methodname":"tool_mobile_get_public_config","args":{}}]'
```
Tiene que contestar `"enablemobilewebservice":1`. Si trae `identityproviders`, el login pasa por un SSO y hay que cargar su host en `ssoHost`.

## Tools
### Aula virtual (Moodle)
| Tool | Qué hace |
|---|---|
| `aula_list_courses` | Lista tus cursos. Es el punto de partida. |
| `aula_open` | Entra a un curso, una sección, un módulo, un foro o una discusión. Cada respuesta trae las direcciones de lo que hay adentro y de un nivel más arriba, así el agente navega sin perderse. Un curso grande llega como índice de secciones con sus actividades, y cada sección se abre aparte. Si algo se recortó para que entre, la respuesta lo avisa y dice cómo verlo. |
| `aula_search` | Busca palabras en uno o en todos tus cursos: secciones, módulos, nombres de archivo y discusiones de los foros. Compara palabras enteras e ignora las de menos de 3 letras, salvo los números. Sirve cuando no sabés en qué materia está algo. |
| `aula_list_upcoming` | Lo que viene en todas tus materias: qué tenés pendiente de entregar o resolver y para cuándo, y el resto del calendario (aperturas, clases, eventos del curso). |
| `aula_read_file` | Lee un archivo del aula, por partes cuando es largo. |
| `aula_get_site_info` | Datos de tu usuario en el aula virtual. |
| `aula_forum_post` | Abre un hilo en un foro o responde en una discusión. |
| `aula_forum_edit_post` | Edita una publicación tuya. |
| `aula_forum_delete_post` | Borra una publicación tuya. |
| `aula_assign_submit` | Entrega una tarea: sube archivos de tu compu, escribe el texto en línea y confirma el envío. |
| `aula_assign_upload_link` | Solo en modo HTTP: un link para subir los archivos de una entrega. |
| `aula_choice_answer` | Responde una elección o te anota en un grupo. |
| `aula_send_message` | Manda un mensaje privado a un docente o compañero. |
| `aula_calendar_add_event` | Agrega un recordatorio a tu calendario del aula. |

### SIU Guaraní (autogestión, G3W)
| Tool | Qué hace |
|---|---|
| `guarani_menu` | Lista las operaciones que tu universidad habilitó (historia académica, plan, inscripciones, mesas…) con su dirección. Si tenés más de una carrera, dice cuál está activa y cómo cambiar a las otras. |
| `guarani_open` | Abre una página de Guaraní y la devuelve como texto, con las tablas fila por fila, los avisos y los enlaces a otras páginas. La historia académica llega por materia, con nota, resultado, fecha y vencimiento de cada registro, y avisa qué regularidades ya vencieron. La oferta de comisiones llega por período y materia, y las dos se pueden filtrar por materia. |

Guaraní no tiene API: el servidor entra con tu usuario y lee las páginas como lo harías vos. Por ahora **solo lee**: para inscribirte, el agente te pasa el link. Las tools solo aparecen si tu campus tiene esa plataforma.

## Cómo instalar
### Instalación fácil: Claude Desktop
1. Bajá `unimcp-<versión>.mcpb` del [último release](https://github.com/HyNuwa/UniMCP/releases/latest).
2. Hacele doble click (o arrastralo a *Configuración → Extensiones* de Claude Desktop) e instalalo.
3. Completá tu campus (el id de la tabla de arriba, por ejemplo `unju`) y tus usuarios y contraseñas del aula y de Guaraní. Claude Desktop guarda las contraseñas de forma segura y solo viajan a tu universidad.

No hace falta instalar nada más: Claude Desktop trae su propio Node.

### Con la terminal (cualquier cliente)
Necesitás [Node.js](https://nodejs.org) 20 o superior.

#### 1. Iniciar sesión
```bash
npx -y unimcp login
```
Elegís tu campus de la lista, y te pide el usuario y la contraseña del aula y después los de Guaraní (que suele ser tu DNI). Se hace una sola vez: después el servidor renueva las sesiones solo.

#### 2. Agregarlo a tu cliente
**Claude Code**
```bash
claude mcp add uni -- npx -y unimcp
```

**Claude Desktop**: en *Settings → Developer → Edit Config*, dentro de `mcpServers`:
```json
"uni": {
  "command": "npx",
  "args": ["-y", "unimcp"]
}
```
En Windows, si no arranca, usá `"command": "cmd"` y `"args": ["/c", "npx", "-y", "unimcp"]`.

**Codex**: `codex mcp add uni -- npx -y unimcp` · **Gemini CLI**: `gemini mcp add uni npx -y unimcp`

**Cursor** (`~/.cursor/mcp.json`) y **VS Code** (`.vscode/mcp.json`): un servidor STDIO con `"command": "npx"` y `"args": ["-y", "unimcp"]`.

Cualquier cliente MCP que lance servidores por STDIO sirve con `npx -y unimcp`.

### Modo HTTP (opcional)
Necesita Node 22.13 o más nuevo:
```bash
npx -y unimcp login --http   # una vez: te muestra el token para el header Authorization
npx -y unimcp --http --port 3000
```
Hosteado, el servidor también hace de servidor de autorización OAuth: el cliente MCP abre una página donde el alumno **elige su campus** y entra con su usuario del aula. La contraseña se usa una sola vez y **no se guarda**. La configuración (quién puede entrar, URL pública, clave de cifrado) está en [`.env.example`](.env.example), con las variables `UNIMCP_*`.

En modo HTTP, **por defecto no hay tools que escriben** (publicar, mandar mensajes, entregar): así, un post que intente darle órdenes al modelo no puede hacer que publique en nombre del alumno. Quien hostea las habilita con `UNIMCP_WRITE_TOOLS` (`all` o una lista de nombres). Instalado en tu compu están todas, y `UNIMCP_WRITE_TOOLS=none` las saca.

En modo HTTP **SIU Guaraní todavía no está disponible**: su sesión vence en minutos y renovarla necesita la contraseña, que el servidor hosteado no guarda.

Con Docker:
```bash
docker build -t unimcp .
docker run -d --name unimcp --network host --restart unless-stopped \
  -e HOST=127.0.0.1 -e PORT=8100 -e UNIMCP_PUBLIC_URL=https://mcp.tu-dominio.com \
  -e UNIMCP_KEY=$(openssl rand -base64 32) -v unimcp-data:/data unimcp
```

## Dónde se guardan tus datos
Instalado en tu computadora, todo queda ahí:
- **Usuarios y contraseñas** (aula y Guaraní): en el gestor de credenciales del sistema (Windows Credential Manager, Keychain en macOS, Secret Service en Linux). Sin gestor, por variables de entorno: `UNI_USER`/`UNI_PASS` y `UNI_GUARANI_USER`/`UNI_GUARANI_PASS`.
- **Campus elegido, token del aula y cookies de sesión**: en `%APPDATA%\unimcp\` (Windows) o `~/.config/unimcp/` (Linux y macOS).
- **Con la extensión de Claude Desktop**: las contraseñas las guarda Claude Desktop (en los campos marcados como sensibles de la extensión), y el token y las cookies van a la misma carpeta.
- **En modo HTTP**: la contraseña no se guarda; la sesión va cifrada en `unimcp.db`, con la clave de `store.key` (o la de `UNIMCP_KEY`). Del token del cliente solo se guarda el hash.

Los links que el agente te pasa abren con la sesión de tu navegador y **nunca incluyen tu token**.

## Desarrollo
```bash
npm install
npm run login   # una vez
npm run dev     # servidor por STDIO desde src/, con tsx
npm test        # tests, con respuestas inventadas de Moodle y G3W
npm run build   # compila a build/
npm run mcpb    # arma la extensión de Claude Desktop (unimcp-<versión>.mcpb)
```
La arquitectura y las convenciones están en [`AGENTS.md`](AGENTS.md), y lo que sigue en el [roadmap](docs/roadmap.md).

## Aviso
Este proyecto no está afiliado ni avalado por ninguna universidad ni por el SIU. Usalo bajo tu responsabilidad.
