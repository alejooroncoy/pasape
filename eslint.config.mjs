import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design handoff bundles — read-only reference, not source.
    "pasape/**",
    "pasapem/**",
    "gaa.ts",
    // Public assets and Supabase migrations are not lint targets.
    "supabase/**",
  ]),
]);

export default eslintConfig;
