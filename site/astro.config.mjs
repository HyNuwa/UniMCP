import { defineConfig } from "astro/config";

// Se publica en GitHub Pages, bajo /UniMCP/. Con un dominio propio, `base` pasa a ser "/".
export default defineConfig({
    site: "https://hynuwa.github.io",
    base: "/UniMCP",
});
