# Pasape — App nativa (Capacitor) para Modo Puerta

El shell nativo (iOS/Android) **no empaqueta** un export estático: la app es
Next.js con backend (API routes, auth, SSR), así que el WebView **carga la web
desplegada** vía `server.url` y le aporta **cámara + BLE**. El service worker
(`next-pwa`) cachea para que el escaneo funcione offline tras la primera carga.

## Apuntar a tu backend

`capacitor.config.ts` lee `CAP_SERVER_URL` (default `https://app.pasape.lat`).
Para probar las features nuevas (QR firmado ECDSA, sesiones de portero,
`/signing-key`, `/join`) **despliega esta rama** (Vercel preview) y apunta ahí:

```bash
CAP_SERVER_URL=https://<tu-preview>.vercel.app npx cap sync
```

Para dev local contra tu máquina (mismo WiFi), usa tu IP LAN:

```bash
CAP_SERVER_URL=http://192.168.x.x:3000 npx cap sync   # cleartext se activa solo
```

## Android — APK de prueba

Requiere JDK 21 (el de Android Studio sirve) y el Android SDK.

```bash
npx cap sync android
pnpm cap:apk
# → android/app/build/outputs/apk/debug/app-debug.apk
```

El APK debug está firmado con el keystore de debug → se instala por sideload en
cualquier Android (Ajustes → permitir orígenes desconocidos), sin Play Store.

## iOS — instalar en iPhone real

Capacitor 8 usa Swift Package Manager (no CocoaPods). El proyecto compila para
simulador sin firma. Para un **iPhone físico** necesitas tu Apple ID/Team:

```bash
npx cap sync ios
npx cap open ios          # abre Xcode
```

En Xcode: target **App** → *Signing & Capabilities* → elige tu *Team* →
conecta el iPhone → Run. (Con una Apple ID gratis el perfil dura 7 días.)

## Permisos ya configurados

- **Android** (`AndroidManifest.xml`): `CAMERA`, `BLUETOOTH_SCAN/CONNECT/ADVERTISE`
  (+ legacy BLE y `ACCESS_FINE_LOCATION` para Android ≤11).
- **iOS** (`Info.plist`): `NSCameraUsageDescription`, `NSBluetoothAlways/PeripheralUsageDescription`.

## Limitación conocida (iOS)

El escaneo de QR usa `BarcodeDetector`, que **no existe en WKWebView (iOS)**.
En Android WebView (Chromium) sí. Para iOS habrá que añadir un fallback
(p. ej. `jsQR`/`zxing-wasm` sobre los frames de la cámara) o un plugin nativo de
escaneo. El BLE (Bloque 7) usa `@capacitor-community/bluetooth-le`, que sí corre
en ambos.
