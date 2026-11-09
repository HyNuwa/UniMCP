# UniMCP: el puente entre tu agente y los sistemas de tu universidad
Este es un Model Context Protocol server **NO OFICIAL** para universidades argentinas. Con él podés pedirle a tu agente (Claude, ChatGPT, etc.) que lea los apuntes del **aula virtual (Moodle)** y consulte tu **SIU Guaraní** y, con tu confirmación, que publique en los foros o entregue tareas. Corre en tu computadora o como servidor HTTP con OAuth.

¿Sos alumno y no programás? Empezá por la [guía para alumnos](docs/guia-alumnos.md).

## Qué podés pedirle
- *"¿Cuándo es el recuperatorio del primer parcial de Álgebra?"*
- *"¿Qué avisó la profesora de Física esta semana?"*
- *"Resumime la guía de la unidad 3 de Sistemas Operativos."*
- *"¿Qué tengo que entregar esta semana?"*
- *"¿Cómo voy en Física?"*
- *"¿Hay algo nuevo en el aula esta semana?"*
- *"¿Me contestó el profe de Álgebra?"*
- *"¿Qué nota me pusieron en el TP1 y qué me corrigieron?"*
- *"¿Qué finales tengo aprobados y cuál es mi promedio?"* (Guaraní)
- *"¿En qué materias estoy inscripto este cuatrimestre?"* (Guaraní)
- *"¿Qué mesas de examen hay para Análisis II?"* (Guaraní)

## Universidades y campus
| Id | Universidad | Campus | Provincia | Aula (Moodle) | Guaraní |
|---|---|---|---|---|---|
| `unju` | UNJu | Universidad Nacional de Jujuy | Jujuy | `virtual.unju.edu.ar` | `alumnos.unju.edu.ar` |
| `unsa-exactas` | UNSa | Facultad de Ciencias Exactas | Salta | `exavirtual.unsa.edu.ar` | `autogestiong3.unsa.edu.ar` |
| `unsa-salud` | UNSa | Facultad de Ciencias de la Salud | Salta | `saludvirtual.unsa.edu.ar` | `autogestiong3.unsa.edu.ar` |
| `unsa-humanidades` | UNSa | Facultad de Humanidades | Salta | `fhvirtual.unsa.edu.ar/moodle` | — |
| `unsa-economicas` | UNSa | Facultad de Ciencias Económicas, Jurídicas y Sociales | Salta | `moodleeco.unsa.edu.ar/moodle` | — |
| `unsa` | UNSa | Otras facultades | Salta | — | `autogestiong3.unsa.edu.ar` |
| `unt-facet` | UNT | FACET | Tucumán | `facetvirtual.facet.unt.edu.ar` | `guarani.unt.edu.ar` |
| `unt-face` | UNT | Ciencias Económicas | Tucumán | `campus2.unt.edu.ar` | `guarani.unt.edu.ar` |
| `unt-filo` | UNT | Filosofía y Letras | Tucumán | `campus.filo.unt.edu.ar` | `guarani.unt.edu.ar` |
| `unt-arquitectura` | UNT | Facultad de Arquitectura y Urbanismo | Tucumán | `campus3.unt.edu.ar` | — |
| `unt-derecho` | UNT | Facultad de Derecho y Ciencias Sociales | Tucumán | `campus4.unt.edu.ar` | — |
| `unt` | UNT | Otras facultades | Tucumán | — | `guarani.unt.edu.ar` |
| `uba-fiuba` | UBA | Ingeniería (FIUBA) | Ciudad Autónoma de Buenos Aires | `campusgrado.fi.uba.ar` | `guaraniautogestion.fi.uba.ar` |
| `uba-exactas` | UBA | Ciencias Exactas y Naturales | Ciudad Autónoma de Buenos Aires | `campus.exactas.uba.ar` (SSO idEx) | `inscripciones.exactas.uba.ar` |
| `uba-agronomia` | UBA | Agronomía (FAUBA) | Ciudad Autónoma de Buenos Aires | `campus.agro.uba.ar` | — |
| `uba-farmacia` | UBA | Farmacia y Bioquímica | Ciudad Autónoma de Buenos Aires | `campus.ffyb.uba.ar` | — |
| `uba-filo` | UBA | Filosofía y Letras | Ciudad Autónoma de Buenos Aires | `campus.filo.uba.ar` | — |
| `uba-sociales` | UBA | Ciencias Sociales | Ciudad Autónoma de Buenos Aires | `campus.sociales.uba.ar` | — |
| `utn-frba` | UTN | Regional Buenos Aires | Ciudad Autónoma de Buenos Aires | `aulasvirtuales.frba.utn.edu.ar` (SSO) | — |
| `utn-frt` | UTN | Regional Tucumán | Tucumán | `frt.cvg.utn.edu.ar` | — |
| `utn-frc` | UTN | Regional Córdoba | Córdoba | `uv.frc.utn.edu.ar` | — |
| `utn-frsf` | UTN | Regional Santa Fe | Santa Fe | `campusvirtual.frsf.utn.edu.ar` | — |
| `utn-fra` | UTN | Facultad Regional Avellaneda | Buenos Aires | `www.utnfravirtual.org.ar` | — |
| `utn-frbb` | UTN | Facultad Regional Bahía Blanca | Buenos Aires | `aulavirtual.frbb.utn.edu.ar` | — |
| `utn-frgp` | UTN | Facultad Regional General Pacheco | Buenos Aires | `frgp.cvg.utn.edu.ar` | — |
| `utn-frlp` | UTN | Facultad Regional La Plata | Buenos Aires | `frlp.cvg.utn.edu.ar` | — |
| `utn-frp` | UTN | Facultad Regional Paraná | Entre Ríos | `frp.cvg.utn.edu.ar` | — |
| `utn-frre` | UTN | Facultad Regional Resistencia | Chaco | `frre.cvg.utn.edu.ar` | — |
| `utn-frro` | UTN | Facultad Regional Rosario | Santa Fe | `frro.cvg.utn.edu.ar` | — |
| `utn-frch` | UTN | Facultad Regional Chubut | Chubut | `frch.cvg.utn.edu.ar` | — |
| `utn-frcon` | UTN | Facultad Regional Concordia | Entre Ríos | `frcon.cvg.utn.edu.ar` | — |
| `utn-frlr` | UTN | Facultad Regional La Rioja | La Rioja | `frlr.cvg.utn.edu.ar` | — |
| `utn-frn` | UTN | Facultad Regional del Neuquén | Neuquén | `frn.cvg.utn.edu.ar` | — |
| `utn-frra` | UTN | Facultad Regional Rafaela | Santa Fe | `frra.cvg.utn.edu.ar` | — |
| `utn-frrq` | UTN | Facultad Regional Reconquista | Santa Fe | `frrq.cvg.utn.edu.ar` | — |
| `utn-frsc` | UTN | Facultad Regional Santa Cruz | Santa Cruz | `frsc.cvg.utn.edu.ar` | — |
| `utn-frsfco` | UTN | Facultad Regional San Francisco | Córdoba | `frsfco.cvg.utn.edu.ar` | — |
| `utn-frsr` | UTN | Facultad Regional San Rafael | Mendoza | `campus.frsr.utn.edu.ar/moodle` | — |
| `utn-frtl` | UTN | Facultad Regional Trenque Lauquen | Buenos Aires | `frtl.cvg.utn.edu.ar` | — |
| `utn-frvm` | UTN | Facultad Regional Villa María | Córdoba | `cvirtual.frvm.utn.edu.ar` | — |
| `unc-famaf` | UNC | Matemática, Astronomía, Física y Computación (FAMAF) | Córdoba | `famaf.aulavirtual.unc.edu.ar` | — |
| `unicen-exactas` | UNICEN | Ciencias Exactas | Buenos Aires | `moodle.exa.unicen.edu.ar` | — |
| `unicen-humanas` | UNICEN | Facultad de Ciencias Humanas | Buenos Aires | `campus.fch.unicen.edu.ar` | — |
| `uns` | UNS | Universidad Nacional del Sur | Buenos Aires | `moodle.uns.edu.ar/moodle` | — |
| `unne` | UNNE | Universidad Nacional del Nordeste | Corrientes | `virtual-moodle.unne.edu.ar` | — |
| `uner-ingenieria` | UNER | Ingeniería (FIUNER) | Entre Ríos | `campus.ingenieria.uner.edu.ar` | — |
| `uncuyo-fad` | UNCuyo | Artes y Diseño | Mendoza | `virtual.fad.uncu.edu.ar` | — |
| `uncuyo-ingenieria` | UNCuyo | Facultad de Ingeniería | Mendoza | `aulaabierta.ingenieria.uncuyo.edu.ar` | — |
| `unsj` | UNSJ | Universidad Nacional de San Juan | San Juan | `campusvirtual.unsj.edu.ar` | — |
| `unsl` | UNSL | Universidad Nacional de San Luis | San Luis | `moodle4vz.unsl.edu.ar/moodle` | — |
| `unlpam-agronomia` | UNLPam | Agronomía | La Pampa | `v5.campus.agro.unlpam.edu.ar` | — |
| `unco` | UNCo | Universidad Nacional del Comahue | Neuquén | `pedco.uncoma.edu.ar` | — |
| `unco-medicas` | UNCo | Facultad de Ciencias Médicas | Río Negro | `campusvirtualfacimed.uncoma.edu.ar` | — |
| `unco-plena` | UNCo | PLENA (Plataforma de Entorno Abierto) | Neuquén | `plena.uncoma.edu.ar` | — |
| `unpsjb` | UNPSJB | Universidad Nacional de la Patagonia San Juan Bosco | Chubut | `campusvirtual.unp.edu.ar` | — |
| `untdf` | UNTDF | Universidad Nacional de Tierra del Fuego | Tierra del Fuego | `campus.untdf.edu.ar` | — |
| `unaf-recursos-naturales` | UNaF | Facultad de Recursos Naturales | Formosa | `frn.ead3.unf.edu.ar` | — |
| `unam-enfermeria` | UNaM | Escuela de Enfermería | Misiones | `aula.escenf.unam.edu.ar` | — |
| `unam-forestales` | UNaM | Facultad de Ciencias Forestales | Misiones | `campusvirtual.fcf.unam.edu.ar` | — |
| `unam-forestales-distancia` | UNaM | Facultad de Ciencias Forestales (a distancia) | Misiones | `aulavirtual.fcf.unam.edu.ar` | — |
| `unam-economicas` | UNaM | Facultad de Ciencias Económicas | Misiones | `aulavirtual.fce.unam.edu.ar` | — |
| `unam-economicas-distancia` | UNaM | Facultad de Ciencias Económicas (a distancia) | Misiones | `ead.fce.unam.edu.ar` | — |
| `unam-exactas` | UNaM | Facultad de Ciencias Exactas, Químicas y Naturales | Misiones | `www.fceqyn.unam.edu.ar/moodle` | — |
| `unam-humanidades` | UNaM | Facultad de Humanidades y Ciencias Sociales | Misiones | `virtual.fhycs.unam.edu.ar` | — |
| `unam-ingenieria` | UNaM | Facultad de Ingeniería | Misiones | `aulavirtual.fio.unam.edu.ar` | — |
| `unca` | UNCA | Universidad Nacional de Catamarca | Catamarca | `campus.unca.edu.ar/campus` | — |
| `unlar` | UNLaR | Universidad Nacional de La Rioja | La Rioja | `campusvirtual.unlar.edu.ar` | — |
| `unse` | UNSE | Campus virtual (SIED) | Santiago del Estero | `campusvirtual.unse.edu.ar` | — |
| `unse-fceyt` | UNSE | Facultad de Ciencias Exactas y Tecnologías | Santiago del Estero | `cuv-fceyt.unse.edu.ar` | — |
| `unlp-naturales` | UNLP | Facultad de Ciencias Naturales y Museo | Buenos Aires | `aulasvirtuales.fcnym.unlp.edu.ar` | — |
| `unlp-aulasweb-grado` | UNLP | AulasWeb Grado (varias facultades) | Buenos Aires | `aulaswebgrado.ead.unlp.edu.ar` | — |
| `unlp-aulasweb-posgrado` | UNLP | AulasWeb Posgrado (varias facultades) | Buenos Aires | `aulaswebposgrado.ead.unlp.edu.ar` | — |
| `unr-comunidades` | UNR | Comunidades (plataforma general) | Santa Fe | `comunidades.campusvirtualunr.edu.ar` | — |
| `unr-carreras-cursos` | UNR | Carreras y Cursos (a distancia) | Santa Fe | `cursos.campusvirtualunr.edu.ar` | — |
| `unr-derecho` | UNR | Facultad de Derecho | Santa Fe | `comunidades5.campusvirtualunr.edu.ar` | — |
| `unr-economicas` | UNR | Facultad de Ciencias Económicas y Estadística | Santa Fe | `comunidades3.campusvirtualunr.edu.ar` | — |
| `unr-humanidades-artes` | UNR | Facultad de Humanidades y Artes | Santa Fe | `comunidades4.campusvirtualunr.edu.ar` | — |
| `unr-medicas` | UNR | Facultad de Ciencias Médicas | Santa Fe | `comunidades2.campusvirtualunr.edu.ar` | — |
| `unr-psicologia` | UNR | Facultad de Psicología | Santa Fe | `comunidades1.campusvirtualunr.edu.ar` | — |
| `unvm` | UNVM | Campus virtual | Córdoba | `campusvirtual.unvm.edu.ar` | — |
| `unvm-distancia` | UNVM | Educación a distancia | Córdoba | `distancia.unvm.edu.ar` | — |
| `uader` | UADER | Campus de educación a distancia | Entre Ríos | `campusuader.entrerios.gov.ar` | — |
| `uader-gestion` | UADER | Facultad de Ciencias de la Gestión | Entre Ríos | `fcgvirtual.entrerios.gov.ar` | — |
| `uader-vida-salud` | UADER | Facultad de Ciencias de la Vida y la Salud | Entre Ríos | `fcvsvirtual.entrerios.gov.ar` | — |
| `uader-ciencia-tecnologia` | UADER | Facultad de Ciencia y Tecnología | Entre Ríos | `fcytvirtual.entrerios.gov.ar` | — |
| `uader-humanidades` | UADER | Facultad de Humanidades, Artes y Ciencias Sociales | Entre Ríos | `fhaycsvirtual.uader.edu.ar` | — |
| `unl-economicas` | UNL | Facultad de Ciencias Económicas | Santa Fe | `servicios.unl.edu.ar/aulavirtual/fce` | — |
| `unl-ingenieria-quimica` | UNL | Facultad de Ingeniería Química | Santa Fe | `servicios.unl.edu.ar/aulavirtual/fiq` | — |
| `unlu` | UNLu | Universidad Nacional de Luján | Buenos Aires | `moodle.unlu.edu.ar` | — |
| `unmdp-faud` | UNMdP | Facultad de Arquitectura, Urbanismo y Diseño | Buenos Aires | `campusfaud.mdp.edu.ar` | — |
| `unsam-unidad-central` | UNSAM | Unidad Central | Buenos Aires | `campusvirtualunidadcentral.unsam.edu.ar` | — |
| `unsam-ciencia-tecnologia` | UNSAM | Ciencia y Tecnología (ECyT, EByN, INCALIN, Sabato y Dan Beninson) | Buenos Aires | `campusvirtualecyt.unsam.edu.ar` | — |
| `unsam-economia-negocios` | UNSAM | Escuela de Economía y Negocios | Buenos Aires | `campusvirtualeeyn.unsam.edu.ar` | — |
| `unsam-habitat-arte-rehabilitacion` | UNSAM | Escuelas de Hábitat y Sostenibilidad, Arte y Patrimonio e ICRM | Buenos Aires | `campusvirtualhsyaeicrm.unsam.edu.ar` | — |
| `unsam-humanidades` | UNSAM | Escuela de Humanidades | Buenos Aires | `campusvirtualhu.unsam.edu.ar` | — |
| `unsam-lenguas` | UNSAM | Programa de Lenguas | Buenos Aires | `campusvirtuallenguas.unsam.edu.ar` | — |
| `unsam-sociales` | UNSAM | Sociales (EPyG e EIDAES) | Buenos Aires | `campusvirtualsociales.unsam.edu.ar` | — |
| `unahur` | UNAHUR | Universidad Nacional de Hurlingham | Buenos Aires | `campus2026.unahur.edu.ar` | — |
| `unpaz` | UNPAZ | Universidad Nacional de José C. Paz | Buenos Aires | `campusvirtual.unpaz.edu.ar` | — |

Cada aula se verificó con `tool_mobile_get_public_config` (el servicio móvil de Moodle tiene que estar habilitado) y cada Guaraní con su página de login de autogestión. Entran las aulas con login propio de Moodle o con SSO de Keycloak: las que entran con SAML, OAuth2 o un portal propio (como varias de la UNC) todavía no. Probado a fondo solo en **UNJu**; los demás **faltan probarlos con usuarios reales**. Si sos de otra universidad, probalo y contanos cómo te fue con la plantilla [Probé mi universidad](https://github.com/HyNuwa/UniMCP/issues/new?template=probe-mi-universidad.yml), aunque haya andado todo bien. Si tu facultad usa Moodle y no está, pedila con [Pedir mi universidad](https://github.com/HyNuwa/UniMCP/issues/new?template=pedir-universidad.yml). Más formas de colaborar en [CONTRIBUTING.md](CONTRIBUTING.md).

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
| `aula_open` | Entra a un curso, una sección, un módulo, un foro o una discusión. Cada respuesta trae las direcciones de lo que hay adentro y de un nivel más arriba, así el agente navega sin perderse. Un curso grande llega como índice de secciones con sus actividades, y cada sección se abre aparte. Un cuestionario trae si está abierto o cerrado, sus fechas, el límite de tiempo y los intentos que te quedan (nunca las preguntas). Si algo se recortó para que entre, la respuesta lo avisa y dice cómo verlo. |
| `aula_search` | Busca palabras en uno o en todos tus cursos: secciones, módulos, nombres de archivo y discusiones de los foros. Compara palabras enteras e ignora las de menos de 3 letras, salvo los números. Sirve cuando no sabés en qué materia está algo. |
| `aula_list_upcoming` | Lo que viene en todas tus materias: qué tenés pendiente de entregar o resolver y para cuándo, y el resto del calendario (aperturas, clases, eventos del curso). |
| `aula_list_grades` | Tus notas: un resumen de cada materia o, en una, cada ítem del libro de calificaciones con su nota, rango y la devolución del docente. Avisa si el docente oculta las notas. |
| `aula_list_updates` | Qué cambió en tus materias en los últimos días: material nuevo, actividades editadas, foros con mensajes nuevos, notas. |
| `aula_list_messages` | Tus mensajes privados del aula: las conversaciones con lo último de cada una y cuántas tenés sin leer, o los mensajes de una. No las marca como leídas. |
| `aula_read_file` | Lee un archivo del aula, por partes cuando es largo. |
| `aula_get_site_info` | Datos de tu usuario en el aula virtual. |
| `aula_forum_post` | Abre un hilo en un foro o responde en una discusión. |
| `aula_forum_edit_post` | Edita una publicación tuya. |
| `aula_forum_delete_post` | Borra una publicación tuya. |
| `aula_assign_submit` | Entrega una tarea: sube archivos de tu compu, escribe el texto en línea y confirma el envío. Primero muestra una vista previa (qué archivos se suman, cuáles quedan y cuáles se quitan) y entrega recién cuando confirmás. |
| `aula_assign_upload_link` | Solo en modo HTTP: un link para subir los archivos de una entrega. |
| `aula_choice_answer` | Responde una elección o te anota en un grupo. |
| `aula_send_message` | Manda un mensaje privado a un docente o compañero de tus cursos. Primero muestra a quién le llega y con qué rol, y lo manda recién cuando confirmás. |
| `aula_calendar_add_event` | Agrega un recordatorio a tu calendario del aula. |

También trae un **prompt**, `aula_plan_semana` (en Claude Desktop, en el menú "+"): arma el plan de la semana con lo que tenés que entregar, lo nuevo en el aula y cómo vas en cada materia.

### SIU Guaraní (autogestión, G3W)
| Tool | Qué hace |
|---|---|
| `guarani_menu` | Lista las operaciones que tu universidad habilitó (historia académica, plan, inscripciones, mesas…) con su dirección. Si tenés más de una carrera, dice cuál está activa y cómo cambiar a las otras. |
| `guarani_open` | Abre una página de Guaraní y la devuelve como texto, con las tablas fila por fila, los avisos y los enlaces a otras páginas. La historia académica llega por materia, con nota, resultado, fecha y vencimiento de cada registro, y avisa qué regularidades ya vencieron. La oferta de comisiones llega por período y materia, y las dos se pueden filtrar por materia. |

Guaraní no tiene API: el servidor entra con tu usuario y lee las páginas como lo harías vos. Por ahora **solo lee**: para inscribirte, el agente te pasa el link. Las tools solo aparecen si tu campus tiene esa plataforma.

## Cómo instalar
### Instalación fácil: Claude Desktop
1. Descargá la extensión: [`unimcp.mcpb`](https://github.com/HyNuwa/UniMCP/releases/latest/download/unimcp.mcpb) (también está en el [último release](https://github.com/HyNuwa/UniMCP/releases/latest), con la versión en el nombre).
2. Hacele doble click (o arrastralo a *Configuración → Extensiones* de Claude Desktop) e instalalo.
3. Completá tu campus (el id de la tabla de arriba, por ejemplo `unju`) y tus usuarios y contraseñas del aula y de Guaraní. Claude Desktop guarda las contraseñas de forma segura y solo viajan a tu universidad.

No hace falta instalar nada más: Claude Desktop trae su propio Node.

### Con la terminal (cualquier cliente)
Necesitás [Node.js](https://nodejs.org) 22 o superior.

#### 1. Iniciar sesión
```bash
npx -y @nuwujix/unimcp login
```
Buscás tu campus por sigla, facultad o provincia (`UNC`, `exactas`, `Córdoba`), y te pide el usuario y la contraseña del aula y después los de Guaraní (que suele ser tu DNI). Si te equivocás de contraseña, te la vuelve a pedir (hasta 3 veces, para que no se bloquee tu cuenta). Se hace una sola vez: después el servidor renueva las sesiones solo.

Para ver si anda todo, `npx -y @nuwujix/unimcp check` prueba los logins y dice qué tools funcionan en tu aula, sin mostrar datos personales. Si anduvo, pegá el resumen en [el hilo del mapa](https://github.com/HyNuwa/UniMCP/discussions/64) y aparecés en la [web](https://hynuwa.github.io/UniMCP/#mapa), en el pin de tu campus.

#### 2. Agregarlo a tu cliente
**Claude Code**
```bash
claude mcp add uni -- npx -y @nuwujix/unimcp
```

**Claude Desktop**: en *Settings → Developer → Edit Config*, dentro de `mcpServers`:
```json
"uni": {
  "command": "npx",
  "args": ["-y", "@nuwujix/unimcp"]
}
```
En Windows, si no arranca, usá `"command": "cmd"` y `"args": ["/c", "npx", "-y", "@nuwujix/unimcp"]`.

**Codex**: `codex mcp add uni -- npx -y @nuwujix/unimcp` · **Gemini CLI**: `gemini mcp add uni npx -y @nuwujix/unimcp`

**Cursor** (`~/.cursor/mcp.json`) y **VS Code** (`.vscode/mcp.json`): un servidor STDIO con `"command": "npx"` y `"args": ["-y", "@nuwujix/unimcp"]`.

Cualquier cliente MCP que lance servidores por STDIO sirve con `npx -y @nuwujix/unimcp`.

### Modo HTTP (opcional)
Necesita Node 22.13 o más nuevo:
```bash
npx -y @nuwujix/unimcp login --http   # una vez: te muestra el token para el header Authorization
npx -y @nuwujix/unimcp --http --port 3000
```
Hosteado, el servidor también hace de servidor de autorización OAuth: el cliente MCP abre una página donde el alumno **elige su campus** y entra con su usuario del aula. La contraseña se usa una sola vez y **no se guarda**. La configuración (quién puede entrar, URL pública, clave de cifrado) está en [`.env.example`](.env.example), con las variables `UNIMCP_*`.

En modo HTTP, **por defecto no hay tools que escriben** (publicar, mandar mensajes, entregar): así, un post que intente darle órdenes al modelo no puede hacer que publique en nombre del alumno. Quien hostea las habilita con `UNIMCP_WRITE_TOOLS` (`all` o una lista de nombres), y si faltan, el servidor se lo avisa al agente para que te diga que lo hagas desde el aula. Instalado en tu compu están todas, y `UNIMCP_WRITE_TOOLS=none` las saca.

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

Los datos de otras personas que aparecen en el aula (una lista de alumnos con DNI o legajo, el teléfono o el mail de un compañero) no le llegan al agente: las listas se resumen en si figurás o no, y los DNI, emails y teléfonos sueltos se tapan. Quedan los tuyos y los mails institucionales o de contacto de la cátedra. En tu compu podés verlos enteros con `UNI_SHOW_THIRD_PARTY_DATA=1`.

Si encontrás una falla de seguridad, reportala en privado como explica [SECURITY.md](SECURITY.md).

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
