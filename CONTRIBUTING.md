# Cómo colaborar

UniMCP está probado a fondo en una sola universidad (UNJu). Lo que más falta es gente de **otras universidades** que lo pruebe con su cuenta y cuente qué anda y qué no: Moodle y SIU Guaraní cambian entre universidades y versiones, y eso solo se ve con un usuario real.

No hace falta saber programar para lo primero.

## 1. Probalo con tu universidad

1. Instalalo como dice el [README](README.md#cómo-instalar): `npx -y unimcp login`, elegí tu campus (o `personalizado` si no está) y agregalo a tu cliente.
2. Pedile a tu agente cosas de todos los días: que liste tus cursos, que abra una materia y lea un apunte, que busque algo en los foros, tu historia académica, tus inscripciones, las mesas de examen.
3. Contanos cómo te fue con la plantilla [**Probé mi universidad**](https://github.com/HyNuwa/UniMCP/issues/new?template=probe-mi-universidad.yml), aunque haya andado todo bien.

### Sin datos personales

Los issues son públicos. **No pegues** tu nombre, DNI, legajo, notas, mails ni capturas de tu historia académica o de los foros. Describí el problema ("la historia académica sale vacía", "el login de Guaraní dice usuario incorrecto y en la web entro bien") y, si hace falta mostrar una respuesta, reemplazá los datos por otros inventados.

## 2. Sumá tu campus al registro

Si tu facultad no está en la tabla del README:

1. Verificá que su Moodle tenga el servicio móvil habilitado, con el `curl` de [Sumar tu campus](README.md#sumar-tu-campus). Tiene que contestar `"enablemobilewebservice":1`; si trae `identityproviders`, el login pasa por un SSO.
2. Buscá la autogestión de Guaraní: es la página donde los alumnos entran a ver sus notas, y termina en algo como `/autogestion`.
3. Probalo con `personalizado` y las variables `UNI_AULA_BASE_URL` / `UNI_GUARANI_URL`.
4. Si anduvo, abrí un PR que agregue la entrada en `CAMPUSES` de `src/shared/campus.ts` y la fila en la tabla del README. O abrí el issue con las URLs y lo sumamos nosotros.

## 3. Código

```bash
git clone https://github.com/HyNuwa/UniMCP.git && cd UniMCP
npm install
npm run login        # una vez, con tu campus
npm run dev          # servidor por STDIO desde src/
npx tsc --noEmit     # tipos
npm test             # tests, con respuestas inventadas de Moodle y G3W
```

La arquitectura y las convenciones (capas, nombres, cómo se diseña una tool, español con voseo en todo lo que lee una persona o el modelo) están en [`AGENTS.md`](AGENTS.md). Leelo antes de un PR grande; si usás un agente para programar, ya lo lee solo. El plan de lo que sigue está en [`docs/roadmap.md`](docs/roadmap.md).

Para cambios grandes, abrí primero un issue y lo charlamos. Los tests nunca usan datos reales de alumnos.
