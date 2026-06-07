import type { CapacitorConfig } from "@capacitor/cli";

// La app es Next.js con backend (API routes, auth, SSR), así que el shell nativo
// NO empaqueta un export estático: carga la web desplegada vía server.url y le
// aporta cámara + BLE. El service worker (next-pwa) cachea para offline.
//
// Para probar las features nuevas (QR firmado, sesiones, signing-key) hay que
// desplegar esta rama y apuntar CAP_SERVER_URL a esa URL antes de `cap sync`.
//   CAP_SERVER_URL=https://<preview>.vercel.app npx cap sync
const serverUrl = process.env.CAP_SERVER_URL ?? "https://app.pasape.lat";

const config: CapacitorConfig = {
  appId: "lat.pasape.app",
  appName: "Pasape",
  webDir: "capacitor-www",
  server: {
    url: serverUrl,
    // cleartext solo para dev local (http://<LAN>:3000); en prod va https.
    cleartext: serverUrl.startsWith("http://"),
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: "Buscando puertas…",
        cancel: "Cancelar",
        availableDevices: "Puertas disponibles",
        noDeviceFound: "No se encontraron puertas",
      },
    },
  },
};

export default config;
