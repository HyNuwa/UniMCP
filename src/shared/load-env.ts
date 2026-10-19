import { existsSync } from "node:fs";

// Se evalúa antes que los demás módulos, para que las variables del `.env` (como UNI_CAMPUS y
// UNI_AULA_BASE_URL) ya estén cargadas cuando se eligen el campus y sus plataformas.
if (existsSync(".env")) process.loadEnvFile(".env");
