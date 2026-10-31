# Roadmap

Paramos el pulido de parsers: el aula y Guaraní de UNJu ya contestan bien las evaluaciones (10/10 en links y tablas, 11/11 en Guaraní). Lo que sigue es poder darle el servidor a otros alumnos. Los hitos van en orden; cada uno dice qué lo cierra.

UniMCP es solo un servidor MCP: el modelo lo pone el cliente (Claude, ChatGPT, un agente propio). Nosotros no elegimos ni pagamos el modelo, así que las respuestas tienen que funcionar también con los modelos chicos que pueda usar un alumno.

Estado al 31/10/2026. Los issues abiertos se clasifican al final. Ya están resueltos los datos de terceros (#17) y las fechas de los cuestionarios (#14), que bloqueaban el hito 4.

## 1. Autenticación multiusuario sin guardar contraseñas

**Objetivo:** que un alumno conecte el servidor hosteado con su aula y su Guaraní sin que guardemos su contraseña.

### Qué ofrece UNJu (relevado el 19/10/2026)

| | Aula (Moodle) | Guaraní (G3W) |
|---|---|---|
| Login | Propio de Moodle, sin SSO: `typeoflogin = 1` (usuario y contraseña desde la app) e `identityproviders` vacío en `tool_mobile_get_public_config`. | Formulario propio (`#guarani_form_login` en `acceso?auth=form`). No hay SSO a la vista. |
| Credencial que queda | Un token del web service (`moodle_mobile_app`), conseguido una vez con `login/token.php`. | La cookie `siu_sess__unju_des01` (`HttpOnly`, sin `expires`: se borra al cerrar el navegador). |
| Cuánto dura | Lo que diga `tokenduration`, que por defecto son 12 semanas para un token creado por el usuario, como el de la app ([`admin/settings/security.php`](https://github.com/moodle/moodle/blob/main/public/admin/settings/security.php), [`lib/external/classes/util.php`](https://github.com/moodle/moodle/blob/main/public/lib/external/classes/util.php)). No sabemos el valor de UNJu. | Minutos, según lo que vimos. No sabemos si el vencimiento es por inactividad o absoluto. |
| Otros caminos | El login por QR de la app está apagado (`tool_mobile_qrcodetype` vacío). | SIU tiene Araí-Usuarios, un IdP con SSO por SAML ([InfoSIU 91](https://www.siu.edu.ar/rd/InfoSIU/infosiu_91.pdf), de 2015), y Guaraní 3w se puede configurar como SP SAML ([documentación de SIU, interfaz SAML](https://documentacion.siu.edu.ar/wiki/SIU-Guarani/version3.21.0/interfaces/saml)). No encontramos una API REST pública para alumnos. |

### Autorización MCP: hecha, falta auditarla

El modo HTTP sigue la [especificación de autorización de MCP](https://modelcontextprotocol.io/specification/latest/basic/authorization) (OAuth 2.1), en `src/oauth/server.ts`:

- Metadata del servidor de autorización (`/.well-known/oauth-authorization-server`) y del recurso protegido (`/.well-known/oauth-protected-resource`).
- Registro dinámico de clientes (`/register`).
- PKCE obligatorio con `S256`.
- `resource` validado contra el único recurso, `/mcp` (`invalid_target`).
- `/revoke`.

El token que recibe el cliente MCP es nuestro y nunca viaja a Moodle ni a Guaraní: el del aula queda en el servidor. Falta repasar la implementación contra la última revisión de la especificación y probarla con los clientes reales (Claude, ChatGPT).

### Aula: casi resuelto

El alumno escribe la contraseña en la página de login del servidor, se usa una vez con `login/token.php` y se guardan solo el token y las cookies (`StoredAulaSession`), cifrados en reposo con AES-256-GCM y la clave `UNIMCP_KEY`, que no vive en el mismo disco que la base. Falta:

- **Transparencia:** la página de login tiene que decir, antes de que el alumno escriba, que la contraseña pasa por este servidor una sola vez, que no se guarda y qué se guarda en su lugar. Es la diferencia de fondo con un SSO, y el alumno tiene que poder decidir.
- **Borrado:** hoy, desconectar una app (`/admin/clientes/revocar`) borra solo nuestros tokens, pero la sesión del aula sigue en la base. Al cerrar sesión o darse de baja hay que borrar también el token de Moodle y las cookies, y con la baja, el usuario entero.
- **Revocación del lado de Moodle:** el alumno tiene que poder invalidar el token aunque nuestro servidor no responda. Moodle tiene la página de claves de seguridad del usuario (`user/managetoken.php`); hay que verificar si UNJu la habilita para el servicio de la app y documentarlo.
- Medir el `tokenduration` real de UNJu: anotar cuándo se creó un token y hasta cuándo funciona. Si son las 12 semanas por defecto, el alumno vuelve a entrar una vez por cuatrimestre.
- Que el vencimiento llegue bien al alumno: `LoginRequiredError` con el link para volver a entrar, en vez de un error genérico en medio de una conversación.

### Guaraní: el problema de verdad

Sin contraseña guardada, la cookie dura minutos y renovarla pide volver a entrar. Opciones, de la más rápida a la más sólida:

1. **Login por pedido.** El alumno entra a Guaraní desde la página del servidor cuando lo necesita, y guardamos solo la cookie mientras viva. Funciona ya, pero obliga a entrar en cada conversación.
2. **Mantener viva la sesión.** Si el vencimiento es por inactividad, un pedido liviano cada tantos minutos la extiende, pero solo mientras el alumno está usando el servidor. Hay que medirlo primero y no cargar el servidor de la universidad: nada de mantener sesiones abiertas de noche.
3. **SSO institucional.** Si UNJu tiene, o pone, Araí-Usuarios (SAML) delante de Guaraní, el servidor puede ser un SP más y conseguir la sesión sin ver la contraseña. Depende de la universidad.
4. **Guaraní local, en un esquema híbrido.** El alumno conecta su cliente a dos servidores MCP: el hosteado para el aula y un `npx unimcp` local que solo registra Guaraní. La contraseña de Guaraní queda en el llavero de su propia computadora y los pedidos salen de su IP, como si navegara él. Ya funciona hoy; falta un modo local "solo Guaraní" y documentar cómo configurar los dos servidores en cada cliente. La contra: no sirve en clientes web o móviles que no pueden correr un proceso local.

En las opciones 1 a 3, la contraseña (o la sesión SAML) pasa por el servidor igual que en el aula, así que vale lo mismo de transparencia y borrado.

**Tareas:**
- Medir cuánto vive una sesión de G3W de UNJu: entrar y pedir una página después de 5, 10, 20, 30 y 60 minutos sin uso, y repetir con pedidos cada 5 minutos. Eso decide entre las opciones 1 y 2.
- Preguntarle a la Dirección de Sistemas de UNJu si usan Araí-Usuarios o algún IdP, y si aceptarían un SP. Si hay un convenio posible, es el único camino que escala a otras universidades.
- Decidir el modo de Guaraní para el hito 4. Si no hay SSO, lo más probable es la 4 para quien tenga un cliente de escritorio y la 1 para el resto.

### Hosteado: límites hacia la universidad

Hosteado, todos los pedidos de todos los alumnos salen de la IP del servidor. Para el firewall de la universidad, muchos logins distintos desde una misma IP se parecen a un ataque de credenciales, y un bloqueo deja sin servicio a todos a la vez. Por eso:

- Límites de frecuencia conservadores por plataforma, para todo el servidor y por alumno, sobre todo en los logins (`token.php`, el formulario de G3W). Hoy limitamos los intentos contra nuestro propio login (`RateLimiter` en `src/oauth/`) y los pedidos simultáneos de cada sesión al web service del aula (6, en `web-service.ts`); falta un límite para todo el servidor y para los logins contra la universidad.
- Reintentos con espera creciente, y frenar todo ante un 429, un 403 o una página de bloqueo, en lugar de insistir. El web service del aula ya reintenta dos veces ante 429 (y 503 en las lecturas) respetando `Retry-After`, y no insiste si pide esperar más de 10 s; falta frenar todo el servidor.
- La opción 2 de Guaraní (mantener viva la sesión) es la más expuesta: un pedido por alumno cada pocos minutos. Si se usa, solo mientras hay una conversación activa.
- Avisarle a la universidad antes de abrirlo a más alumnos. Además de evitar el bloqueo, es la puerta para la opción 3.

**Cierra el hito:** un alumno de prueba conecta el servidor hosteado al aula y a Guaraní, lo usa durante una semana y en ningún lugar del store hay una contraseña.

## 2. Una segunda universidad

**Objetivo:** probar que los drivers no dependen de UNJu.

Todas las aulas del registro aceptan login con contraseña desde la app (`typeoflogin = 1`), y solo Exactas UBA suma un SSO (idEx). Las cinco autogestiones del registro (UNJu, UNSa, UNT, FIUBA y Exactas UBA) muestran el mismo formulario de G3W y las mismas pagelets. Las candidatas:

- **UNSa (Exactas)**, recomendada: Moodle con login propio y G3W, como UNJu, pero con otra instalación y otra versión. Valida los parsers sin sumar otro flujo de login.
- **Exactas UBA**: suma el camino SSO del aula (launch.php con Keycloak). Conviene como tercera.

**Tareas:**
- Conseguir un alumno con cuenta en la universidad elegida. Bloquea todo lo demás.
- Correr las mismas preguntas, adaptadas a sus materias, y comparar llamadas y aciertos con UNJu.
- Anotar cada diferencia de G3W (menú, historia, oferta, charset) como un issue. Las que rompan un parser lo dejan caer al texto (`registrosSinParsear`, `undefined`), así que el objetivo es que ninguna respuesta salga mal, aunque salga menos estructurada.

**Cierra el hito:** las evaluaciones de la segunda universidad dan los mismos aciertos que las de UNJu, sin código específico de una universidad fuera de `shared/campus.ts`.

## 3. Evaluación con un modelo chico

**Objetivo:** que las respuestas del servidor funcionen con los modelos chicos que puede usar un alumno en su cliente, no solo con el que usamos para desarrollar. El modelo no lo elegimos nosotros; lo que sí controlamos es cuánto texto devolvemos y qué tan claras son las descripciones.

**Tareas:**
- Correr `evals/run_eval.py` con un modelo chico (por ejemplo `-m claude-haiku-5-5`) sobre `evals/unju.xml`, `evals/unju-links-tablas.xml` y `evals/unju-guarani.xml`, y sobre las de la segunda universidad. Si se puede, sumar un modelo de otro proveedor.
- Medir por pregunta: acierto, llamadas a tools y caracteres devueltos por las tools. Eso es lo que le cuesta al alumno en contexto y en plata.
- Donde falle, mirar el transcript antes de tocar código. Lo más probable es que las descripciones de las tools o los avisos necesiten ser más directos (por ejemplo, usar `materia` de entrada), no que haya que cambiar los parsers.

**Cierra el hito:** el modelo chico acierta al menos el 90% de cada evaluación, con no más del doble de llamadas que el modelo de desarrollo.

## 4. Prueba con 3 a 5 alumnos reales

**Objetivo:** ver qué preguntan de verdad y dónde falla.

**Tareas:**
- Consentimiento escrito: qué datos ve el servidor, que la contraseña pasa por él, qué se guarda (token y cookies, cifrados), cómo desconectarse y darse de baja, y que el modelo lo pone su cliente, con las condiciones de ese proveedor. Revisarlo contra la Ley 25.326 de Protección de Datos Personales.
- Los logs, sin datos del alumno: hoy los parsers ya loguean sin números, y hay que revisar el resto.
- Una forma simple de reportar una respuesta mala, con la pregunta y sin copiar datos del aula.
- Dos semanas de uso, de preferencia durante inscripciones o parciales. Al final, sumar las preguntas reales a las evaluaciones.

**Cierra el hito:** 3 a 5 alumnos lo usaron dos semanas, y cada falla reportada tiene un issue o una pregunta nueva en `evals/`.

## Issues abiertos

| Issue | Bloquea | Por qué |
|---|---|---|
| [#18](https://github.com/HyNuwa/UniMCP/issues/18) Dos promedios en `porcentaje_avance_carrera` | **Hito 4** | "¿Cuál es mi promedio?" es de las primeras cosas que va a preguntar un alumno, y hoy la página muestra dos valores sin decir cuál vale. Conviene revisarlo también en la segunda universidad (hito 2). |
| [#16](https://github.com/HyNuwa/UniMCP/issues/16) Fechas en la búsqueda | Backlog | Cuesta llamadas de más, no da respuestas malas. Revisarlo con los resultados del hito 3: si el modelo chico se pierde buscando fechas, sube de prioridad. |
| [#12](https://github.com/HyNuwa/UniMCP/issues/12) `otrasPropuestas` en `guarani_open` | Backlog | Una llamada de más, y solo para alumnos con dos carreras. |

Los hitos 1 a 3 no tienen issues abiertos que los bloqueen, pero sus tareas todavía no están cargadas: cada una se abre como issue cuando se empieza el hito.
