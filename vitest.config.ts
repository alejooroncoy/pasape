import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Carga .env / .env.local en process.env para los tests de integración que
// tocan Supabase (los unitarios puros lo ignoran). Sin credenciales, esos tests
// se auto-saltan (describe.skipIf). Mini-parser propio para no depender de vite.
const loadDotenv = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m && !m[1].startsWith("#")) {
          out[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // archivo ausente → se ignora
    }
  }
  return out;
};

// Resuelve el alias "@/..." (= ./src) en runtime para los tests. Sin esto,
// vitest solo resolvía imports type-only de "@/"; los imports de valores fallan.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" siempre lanza fuera del bundler de Next (que lo
      // intercepta especialmente para React Server Components) — bajo
      // vitest (Node puro) hace falta un no-op para poder importar código
      // de servidor en los tests.
      "server-only": fileURLToPath(new URL("./scripts/server-only-shim.ts", import.meta.url)),
    },
  },
  test: {
    env: loadDotenv(),
    // Los worktrees de asistentes viven dentro del repo durante una sesión. No
    // son código de esta rama y Vitest no debe ejecutar sus copias de tests: al
    // hacerlo se duplican fixtures remotos y aparecen falsos negativos.
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
  },
});
