import { existsSync } from "node:fs";

// Se evalúa antes que los demás módulos, para que las variables del `.env` (como UNI_CAMPUS y
// UNI_AULA_BASE_URL) ya estén cargadas cuando se eligen el campus y sus plataformas.
if (existsSync(".env")) process.loadEnvFile(".env");

// La extensión de Claude Desktop pasa la configuración como variables; un campo opcional que quedó vacío
// puede llegar vacío o con el placeholder sin reemplazar ("${user_config.guarani_usuario}"). Así se toma
// como no definido y, por ejemplo, el campus personalizado no recibe una URL vacía.
for (const [name, value] of Object.entries(process.env)) {
    if (name.startsWith("UNI") && (!value?.trim() || value.startsWith("${user_config."))) delete process.env[name];
}
