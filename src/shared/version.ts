import { createRequire } from "node:module";

/** La versión de `package.json`, la única fuente: está al lado de `src/` y de `build/`. */
export const VERSION: string = createRequire(import.meta.url)("../../package.json").version;
