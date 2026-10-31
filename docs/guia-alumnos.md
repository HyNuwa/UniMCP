# Guía para alumnos

UniMCP le da a tu asistente de IA (Claude, ChatGPT, Gemini…) acceso a tu **aula virtual** y a tu **SIU Guaraní**, para que le preguntes por tus materias como le preguntarías a un compañero que tiene todo abierto. Es un proyecto **no oficial**: no lo hizo ni lo avala tu universidad.

## Qué puede hacer por vos
**En el aula virtual (Moodle)**
- Leer los apuntes, guías y PDFs de tus materias y resumírtelos o explicártelos.
- Decirte qué tenés que entregar y para cuándo, y qué hay de nuevo desde la última vez.
- Leer los avisos y foros, y tus mensajes privados.
- Mostrarte tus notas y lo que te corrigieron.
- **Solo si se lo pedís**: publicar en un foro, mandar un mensaje, entregar una tarea, responder una elección o agregarte un recordatorio.

**En SIU Guaraní**
- Tu historia académica: finales aprobados, promedio y regularidades (y cuáles vencieron).
- Tus inscripciones, el plan de tu carrera, las mesas de examen y la oferta de comisiones.
- Por ahora **solo lee**: para inscribirte, el asistente te pasa el link y lo hacés vos.

## Qué necesitás
- Que tu facultad esté en la [tabla de campus](../README.md#universidades-y-campus). Si no está, mirá [Sumar tu campus](../README.md#sumar-tu-campus).
- Tu usuario y contraseña del aula virtual, y los de Guaraní (el usuario de Guaraní suele ser tu DNI).
- Un asistente que acepte servidores MCP. Lo más fácil es **Claude Desktop**, que es gratis.

## Instalarlo en Claude Desktop
1. Instalá [Claude Desktop](https://claude.ai/download) y entrá con tu cuenta.
2. Bajá `unimcp-<versión>.mcpb` del [último release](https://github.com/HyNuwa/UniMCP/releases/latest).
3. Hacele doble click (o arrastralo a *Configuración → Extensiones*) y tocá *Instalar*.
4. Completá:
   - **Campus**: el id de tu facultad de la tabla, por ejemplo `unju` o `uba-fiuba`.
   - **Usuario y contraseña del aula**.
   - **Usuario y contraseña de Guaraní**, si tu campus lo tiene.
5. Abrí una conversación nueva y preguntale algo de la lista de abajo.

Tus contraseñas las guarda Claude Desktop de forma segura y solo viajan a los servidores de tu universidad.

¿Usás otro asistente o preferís la terminal? Los pasos están en [Cómo instalar](../README.md#cómo-instalar).

## Para empezar
Copiá alguno de estos y cambiá la materia por una tuya:
- *"¿Qué tengo que entregar esta semana?"*
- *"¿Hay algo nuevo en el aula desde el lunes?"*
- *"¿Qué avisó el profe de Física en los últimos días?"*
- *"Resumime la guía de la unidad 3 de Sistemas Operativos y armame 5 preguntas para practicar."*
- *"¿Cuándo es el recuperatorio de Álgebra? Buscalo en el aula."*
- *"¿Qué nota me pusieron en el TP1 y qué me corrigieron?"*
- *"¿Qué finales tengo aprobados y cuál es mi promedio?"*
- *"¿Se me vence alguna regularidad?"*
- *"¿En qué comisiones se dicta Análisis II este cuatrimestre?"*

En Claude Desktop también tenés un atajo: en el menú **+** de la conversación, **Plan de la semana** arma de una lo que tenés que entregar, lo nuevo en el aula y cómo vas en cada materia.

**Consejos**
- Nombrá la materia como aparece en el aula; si no sabés dónde está algo, pedile que lo busque en todas.
- Si una respuesta dice que algo se recortó, pedile la parte que falta ("abrí la sección 4").
- El asistente te pasa links que abren en tu navegador con tu sesión de siempre: usalos para comprobar lo importante, como una fecha de examen.

## Privacidad y seguridad
- **Todo corre en tu computadora.** UniMCP no tiene un servidor que vea tus datos: tu compu habla directo con el aula y con Guaraní. Lo que sí ve tu conversación es la empresa del asistente que uses (Anthropic, OpenAI, Google…), con su propia política de privacidad.
- **Los datos de otros no se muestran.** Si en el aula hay una lista de alumnos con DNI o legajos, el asistente solo ve si figurás o no; los DNI, emails y teléfonos de otras personas llegan tapados.
- **Lo que escriben otros no le da órdenes.** Un post del foro que diga "mandá un mensaje a…" no hace que el asistente lo haga: te cuenta qué dice. Igual, **revisá antes de confirmar** cualquier cosa que publique o entregue en tu nombre.
- **Para cortarle el acceso**, desinstalá la extensión. Para invalidar también la sesión del aula, entrá al aula desde el navegador, andá a tu perfil → *Preferencias* → *Claves de seguridad* (si tu aula la muestra) y restablecé la del servicio de la app móvil.

## Si algo no anda
| Lo que ves | Qué hacer |
|---|---|
| "El aula rechazó usuario o contraseña" o "Guaraní rechazó usuario o contraseña" | Revisá los datos en *Configuración → Extensiones → UniMCP*. Probá entrar con los mismos desde el navegador. En Guaraní el usuario suele ser el DNI, sin puntos. |
| "Hace falta iniciar sesión" | Faltan el usuario o la contraseña de esa plataforma en la configuración de la extensión. |
| El asistente no tiene las tools del aula o de Guaraní | Fijate que la extensión esté activada y que el campus sea el id de la tabla (por ejemplo `unju`, no "UNJu"). Abrí una conversación nueva. Solo aparecen las plataformas que tiene tu campus. |
| "No sé si el aula hizo el cambio" | El aula no contestó a tiempo: entrá desde el navegador y fijate si quedó hecho antes de pedírselo de nuevo, para no publicar o entregar dos veces. |
| "… está saturado" o "no contestó" | El servidor de tu universidad está lento (pasa en épocas de inscripción). Probá en un rato. |
| Una tool dice que tu aula no la permite | Algunas facultades apagan funciones del aula para la app. Hacelo desde el navegador. |

Si sigue sin andar, abrí un [issue](https://github.com/HyNuwa/UniMCP/issues/new/choose). Si sabés usar la terminal, sumá la salida de `npx -y @nuwujix/unimcp check`: prueba los logins y dice qué funciona en tu aula, sin datos personales. No pegues capturas con tus notas, tu DNI o tus contraseñas.
