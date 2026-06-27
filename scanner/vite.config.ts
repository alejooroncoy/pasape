import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// SPA del portero. Reutiliza el código cliente-puro de `../src` vía el alias `@`
// (mismo `@/*` que el proyecto Next). Salida estática en `scanner/dist/`, que
// Capacitor usa como webDir directamente (cap sync la copia a android/ios).
//
// `base: "./"` → rutas relativas en el HTML para que funcione embebido en
// Capacitor (file://) sin servidor de assets.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
    // El código compartido vive en `../src` e importa react / react-query con
    // especificadores bare; sin dedupe, Vite los resuelve desde el node_modules
    // raíz mientras `main.tsx` los toma de `scanner/node_modules` → DOS copias.
    // Resultado: dos contextos de React Query distintos y "No QueryClient set"
    // (pantalla en blanco). dedupe fuerza UNA sola copia de cada uno.
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
