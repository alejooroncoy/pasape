import type { CapacitorConfig } from "@capacitor/cli";

// App nativa del PORTERO (Modo Puerta), offline-first. A diferencia del intento
// anterior (cargar la web Next vía server.url), aquí empaquetamos la SPA Vite
// estática (`scanner/dist`) DENTRO del binario: arranca sin red y valida tickets
// offline (cache local + QR firmado). El backend Next sigue desplegado y se
// consume por HTTP desde la SPA (VITE_API_URL fija __API_BASE__ en build-time).
//
// Build del bundle antes de `cap sync`:
//   cd scanner && VITE_API_URL=https://app.pasape.lat npm run build
//
// Dev con live-reload opcional (NO offline): apuntar a un Vite dev server LAN.
//   CAP_SERVER_URL=http://192.168.x.x:5173 npx cap sync
const devServerUrl = process.env.CAP_SERVER_URL;

// Dev contra el backend Next LOCAL en la LAN (mismo WiFi). El bundle igual carga
// local (offline-first), pero la SPA hace fetch a http://<IP>:3000. Como el dev
// server es http (no https), el WebView lo bloquearía por mixed-content si el
// origin fuera https://localhost. Con CAP_CLEARTEXT=1 servimos el bundle sobre
// http://localhost (sigue siendo secure-context → WebCrypto/QR firmado OK) y
// habilitamos cleartext → el fetch http→http a la LAN pasa. SOLO para dev; la
// build de prod va sin esto (https://localhost + backend https).
//   Construir SPA:  cd scanner && VITE_API_URL=http://192.168.x.x:3000 npm run build
//   Sync:           CAP_CLEARTEXT=1 npx cap sync android
const cleartextDev = process.env.CAP_CLEARTEXT === "1";

const config: CapacitorConfig = {
  appId: "lat.pasape.app",
  appName: "Pasape",
  // Bundle estático de la SPA del portero (no la web Next).
  webDir: "scanner/dist",
  // Sin server.url por defecto = offline-first (carga el webDir local). Solo se
  // activa si CAP_SERVER_URL está seteado (dev live-reload).
  ...(devServerUrl
    ? {
        server: {
          url: devServerUrl,
          cleartext: devServerUrl.startsWith("http://"),
        },
      }
    : cleartextDev
      ? { server: { androidScheme: "http", cleartext: true } }
      : {}),
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
