# Pasape — App nativa (Capacitor) para Modo Puerta

La app del portero **NO** carga la web Next vía `server.url`. Empaqueta dentro
del binario el bundle estático de una SPA Vite aparte (`scanner/`, ver
`scanner/src/ScanScreen.tsx`), así que arranca **sin red** y valida tickets
offline (cache local + QR firmado ECDSA). El backend Next sigue desplegado en
`https://app.pasape.lat` y la SPA lo consume por HTTP (`CapacitorHttp`, sin
CORS ni mixed-content) — `VITE_API_URL` fija ese origin en build-time.

**Varias puertas offline:** cada celular valida de forma autónoma (cache local +
QR firmado ECDSA). No hay sincronización LAN entre dispositivos — es un tradeoff
consciente a favor de velocidad en la puerta.

Si dos porteros escanean el mismo ticket **sin haber sincronizado**, ambos pueden
dejar pasar. Al reconectar, el server marca el segundo como `dup_offline` en
`scan_events` y el panel del organizador muestra el banner de alerta.

**Operación recomendada:**

1. Loguear y **sincronizar el cache** (con señal) antes de abrir la puerta.
2. Si hay varias entradas físicas, **priorizar una puerta con datos** o
   sincronizar cada ~3 min (el panel avisa puertas «stale»).
3. Tras el evento, revisar el banner de duplicados offline en el panel del org.

El escaneo de QR usa `BarcodeDetector` nativo (rápido, robusto con QR
borroso/inclinado) con fallback automático a `jsQR` si no existe en el
WebView — ya soporta iOS y Android, no hay limitación pendiente ahí.

## Build y sync: un solo comando

```bash
npm run build:door-app       # Android: build del bundle scanner/dist + cap sync android
npm run build:door-app:ios   # iOS:     build del bundle scanner/dist + cap sync ios
```

Esto deja `scanner/dist` actualizado y sincronizado en `android/`/`ios/` —
listo para abrir el IDE nativo y generar el instalable. **Corre esto antes de
cualquier build de APK/IPA**; si el bundle web quedó desactualizado, el
paquete nativo sirve una versión vieja del scanner aunque el código fuente
esté al día.

## Generar el instalable

**Android (APK de prueba, debug):**

```bash
npm run build:door-app
npm run cap:apk
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Requiere JDK 21 (el de Android Studio sirve) y el Android SDK. El APK debug
está firmado con el keystore de debug → se instala por sideload (Ajustes →
permitir orígenes desconocidos), sin Play Store.

**iOS (iPhone real):**

```bash
npm run build:door-app:ios
npm run cap:ios     # abre Xcode
```

Capacitor 8 usa Swift Package Manager (no CocoaPods). Compila para simulador
sin firma. Para un iPhone físico: target **App** → *Signing & Capabilities* →
elige tu *Team* → conecta el iPhone → Run. (Con Apple ID gratis el perfil
dura 7 días.)

## Probar en LAN local con live-reload

Para iterar sin rehacer el build nativo cada vez, `capacitor.config.ts` puede
apuntar a un dev server en vez de cargar `scanner/dist`:

```bash
# Vite dev server en tu LAN (recarga en vivo, no offline)
CAP_SERVER_URL=http://192.168.x.x:5173 npx cap sync

# O: bundle local (offline-first) pero fetch al backend Next LOCAL en la LAN.
# CAP_CLEARTEXT permite que el WebView (servido en http://localhost) haga
# fetch http→http a la LAN sin que el mixed-content lo bloquee.
cd scanner && VITE_API_URL=http://192.168.x.x:3000 npm run build && cd ..
CAP_CLEARTEXT=1 npx cap sync android
```

Ninguna de las dos formas es la build de producción — esa va sin `server.url`
ni `CAP_CLEARTEXT`, con `VITE_API_URL=https://app.pasape.lat` (lo que hace
`build:door-app`).

## Permisos ya configurados

- **Android** (`AndroidManifest.xml`): `CAMERA` (escaneo de QR),
  `INTERNET`, `ACCESS_NETWORK_STATE` (detectar online/offline).
- **iOS** (`Info.plist`): `NSCameraUsageDescription`.
