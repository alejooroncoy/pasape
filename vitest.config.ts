import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resuelve el alias "@/..." (= ./src) en runtime para los tests. Sin esto,
// vitest solo resolvía imports type-only de "@/"; los imports de valores fallan.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
