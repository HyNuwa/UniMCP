# Seguridad

UniMCP maneja contraseñas, tokens y datos académicos de alumnos. Si encontrás una falla, contanos en privado antes de publicarla.

## Cómo reportar

Desde la pestaña **Security** del repo, con **Report a vulnerability** ([link directo](https://github.com/HyNuwa/UniMCP/security/advisories/new)). El reporte lo ve solo quien mantiene el proyecto.

**No abras un issue público** ni pegues el detalle en una discusión.

Incluí:
- qué versión usás y cómo lo corrés: STDIO, la extensión de Claude Desktop o el modo HTTP;
- qué pasos reproducen la falla y qué conseguiste con ella.

**Sin datos personales:** si necesitás mostrar una respuesta del aula o de Guaraní, tapá nombres, DNI, emails, notas y tokens.

Es un proyecto chico, mantenido a pulmón. Intentamos confirmar que lo recibimos en una semana y contarte qué vamos a hacer. Si la falla se confirma, la arreglamos en una versión nueva, publicamos el aviso y te damos el crédito, salvo que prefieras que no.

## Versiones

Los arreglos salen solo en la última versión publicada en npm y en los releases de GitHub.

## Qué entra

- **Fugas de credenciales.** Que el token del aula, las cookies de Guaraní o una contraseña lleguen al modelo, a una URL, a los logs o a otro usuario.
- **Datos de otro alumno.** Que en el modo HTTP un usuario pueda ver o tocar la sesión o los datos de otro.
- **Pedidos a donde no corresponde.** Que el servidor mande el token o las cookies a un sitio que no es el aula o el Guaraní del usuario.
- **Prompt injection.** Que un texto del aula (un foro, una etiqueta, un archivo) logre que el agente escriba, entregue o mande un mensaje sin que el usuario lo pida.
- **Fallas del modo HTTP.** En el login, el OAuth o los links de subida.

## Qué no entra

- **Fallas del propio Moodle o Guaraní.** Se reportan a la universidad que los administra. Si UniMCP las hace más fáciles de explotar, sí contanos.
- **El modelo hace algo mal sin que haya una falla de UniMCP.** Por ejemplo, se equivoca leyendo una nota. Eso va en un issue común.
