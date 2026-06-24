import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Hooks v5 introduced strict rules that flag valid React patterns
      // (e.g. setState in effects for derived state sync, accessing refs during render
      // for direction tracking). Downgrade to warn until we migrate to useSyncExternalStore.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next (anclados a cualquier nivel para
    // cubrir también copias en worktrees):
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "next-env.d.ts",
    // Worktrees locales de Claude: copias completas del repo (gitignored).
    ".claude/**",
    // Builds nativos de Capacitor (web build copiado + artefactos generados).
    "android/**",
    "ios/**",
    "capacitor-www/**",
    // Assets públicos generados (service worker, etc.) — no son fuente.
    "public/**",
    // Design handoff bundles — read-only reference, not source.
    "pasape/**",
    "pasapem/**",
    "gaa.ts",
    // Public assets and Supabase migrations are not lint targets.
    "supabase/**",
  ]),
]);

export default eslintConfig;
