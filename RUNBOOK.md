# Runbook — Día del evento

Guía corta para actuar rápido si algo falla durante un evento en vivo. Si no encuentras la respuesta aquí en 2 minutos, escala al contacto técnico (ver sección 4).

---

## 1. Antes del evento (checklist)

Hacer esto con al menos 24h y de nuevo 2-3h antes de puertas abiertas:

- [ ] **`MP_ACCESS_TOKEN` en modo producción.** Debe empezar con `APP_USR-`, NO con `TEST-`. Verificar en Vercel → Project → Settings → Environment Variables (entorno **Production**). Un token `TEST-` hace que los pagos reales fallen o queden en sandbox.
- [ ] **`MP_WEBHOOK_SECRET` seteado.** Si falta, el webhook de Mercado Pago **salta la verificación de firma** (`console.warn("[mp-webhook] MP_WEBHOOK_SECRET not set — skipping signature verification (dev only)")` en `src/server/payments/application/HandleWebhook.ts`). Confirmar que está seteado en Production antes del evento — sin esto, cualquiera podría falsificar una confirmación de pago.
- [ ] **Credenciales de Kapso (WhatsApp)** activas: `KAPSO_API_KEY`, `KAPSO_WA_PHONE_NUMBER_ID`, `KAPSO_WA_TEMPLATE_NAME`, `KAPSO_WA_TEMPLATE_LANG`. Sin esto, el ticket no llega por WhatsApp (falla silenciosa — ver escenario 3.1).
- [ ] **`RESEND_API_KEY` activa.** Sin esto, el ticket no llega por email.
- [ ] **`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` y `SENTRY_AUTH_TOKEN`** seteados en Vercel (Production). Sin `SENTRY_DSN` no hay visibilidad de errores en vivo; sin `SENTRY_AUTH_TOKEN` los sourcemaps no se suben y los stack traces en Sentry salen minificados (más difícil debuggear bajo presión).
- [ ] **Cada portero logueado con internet ANTES de llegar al venue.** El login no funciona offline — si un portero llega sin sesión y sin señal en el venue, queda bloqueado hasta conseguir red.
- [ ] **App nativa del portero (scanner) con build actualizado instalado en cada dispositivo.** Correr `npm run build:door-app` (o `build:door-app:ios`) desde la raíz — encadena el build del scanner + `cap sync`. Ver sección "app del portero" en escenario 3.3.
- [ ] **Confirmar `VITE_API_URL` correcto** en `scanner/.env` apuntando al backend de producción (`https://app.pasape.com` o el dominio real) antes de generar el build — si apunta a localhost o a un preview, el portero no podrá escanear nada.

---

## 2. Dónde mirar si algo falla

| Qué buscar | Dónde |
|---|---|
| Errores de la app (excepciones no capturadas, stack traces) | **Sentry** → org `pasape`, proyecto `javascript-nextjs`. https://sentry.io/organizations/pasape/projects/javascript-nextjs/ |
| Logs de funciones serverless / requests | **Vercel Dashboard** → Project → tab "Logs" (o `vercel logs <deployment-url>` por CLI si está instalado) |
| Estado de deploys, cuál está en producción | **Vercel Dashboard** → Project → tab "Deployments" |
| Datos crudos: órdenes, tickets, notification_dispatches | **Supabase Dashboard** → SQL Editor / Table Editor (no hay panel admin propio en la app — ver escenario 3.1 y 3.4) |
| Pagos y estado de transacciones MP | **Panel de Mercado Pago** (cuenta del vendedor) → Actividad / Detalle de la venta |

No existe un panel de administración interno (`/admin`) en la app para consultar el estado de una orden. Hay un endpoint de estado orientado al comprador (`GET /api/tickets/order/[id]/status?email=...`), pero requiere el email del guest y no es una herramienta de operador — para diagnóstico real, usar el SQL Editor de Supabase directamente sobre las tablas `orders`, `tickets`, `notification_dispatches`.

---

## 3. Escenarios comunes y qué hacer

### 3.1 Un asistente pagó pero no le llegó el ticket (WhatsApp o email)

El envío del ticket (`DispatchTicketDelivery`) se dispara automáticamente tras el pago, pero es **fire-and-forget**: si falla, solo queda un `console.error` en los logs de Vercel y un registro en la tabla `notification_dispatches` con `status: "failed"` — **nadie reintenta automáticamente**.

Pasos:
1. Ir a Supabase → SQL Editor → buscar la orden por email o nombre del comprador en `orders`.
2. Revisar `notification_dispatches` para esa orden: ver si el canal (`email` / `whatsapp`) quedó en `"failed"` y el mensaje de error.
3. Revisar Vercel Logs filtrando por el timestamp del pago para ver el `console.error` con el detalle.
4. **Limitación conocida: hoy no existe un endpoint ni script para reenviar el ticket manualmente.** No inventar un procedimiento — si esto pasa, la única vía real es:
   - Confirmar que el pago sí se acreditó (Mercado Pago / tabla `orders`).
   - Dar al asistente su entrada manualmente: mostrarle el link de "Mis entradas" en la web (si tiene cuenta) o, como último recurso, generar el QR desde la base de datos y compartirlo por el canal que sí funcione (ej. WhatsApp directo desde el celular del organizador).
   - Registrar el incidente para agregar un botón/endpoint de "reenviar ticket" después del evento — es una brecha real, no una limitación aceptable a largo plazo.

### 3.2 El checkout está fallando para todos

Causas más probables, en orden de chequeo:
1. **`MP_ACCESS_TOKEN` mal configurado o en modo `TEST-`.** Verificar en Vercel → Environment Variables (Production). Un token de test en producción rechaza pagos reales o los procesa en sandbox (el asistente cree que pagó pero no se acredita nada real).
2. **Mercado Pago caído.** Revisar https://status.mercadopago.com o el panel de MP directamente. Si MP está caído, no hay nada que arreglar del lado de Pasape — comunicar el estado a los organizadores y, si es crítico, considerar venta en puerta en efectivo como respaldo temporal.
3. **`MP_WEBHOOK_SECRET` faltante o incorrecto** puede causar que los pagos se acrediten en MP pero nunca se reflejen como pagados en la app (el webhook llega pero se procesa mal, o en el peor caso el warning de "skipping verification" indica que ni siquiera se está validando — revisar logs de Vercel para `[mp-webhook]`).
4. Revisar Sentry para excepciones en el flujo de pago (`src/server/payments/*`) al momento del fallo.

### 3.3 Un portero no puede escanear

- **Sin sesión:** el login requiere internet — no funciona offline. Si el portero llegó al venue sin loguearse antes, necesita señal (datos móviles o hotspot) para loguearse una vez. Después de logueado, el escaneo funciona offline (arquitectura local-first).
- **Sin red en el momento del escaneo:** no es un problema — el escaneo está diseñado para funcionar offline una vez logueado. Si un escaneo específico falla, verificar que la app tenga el build más reciente (ver checklist) y que el QR no esté fuera de la ventana de 10 segundos (QR rotativo — si el asistente tiene el celular con poca señal, el QR puede haber rotado antes de escanear; pedirle que refresque la pantalla del ticket).
- **App desactualizada o sin `VITE_API_URL` correcto:** si el escaneo nunca valida nada (siempre "QR inválido"), sospechar que el build tiene mal configurado `VITE_API_URL` (apuntando a localhost/preview en vez de producción). Requiere regenerar el build con un solo comando desde la raíz:
  ```bash
  npm run build:door-app       # Android — build del scanner + cap sync
  npm run build:door-app:ios   # iOS
  ```
  Luego reinstalar el APK/IPA actualizado en el dispositivo (`npm run cap:apk` para Android, o abrir el proyecto en Xcode para iOS).

### 3.4 Hay que revertir un deploy rápido

**No hay script ni comando en este repo para hacer rollback — se hace 100% desde el dashboard de Vercel.**

1. Ir a Vercel Dashboard → Project → tab "Deployments".
2. Ubicar el último deployment de producción que funcionaba bien.
3. Click en el menú "..." de ese deployment → **"Instant Rollback"** (o "Promote to Production" según la versión del dashboard).
4. Confirmar. El rollback de Vercel es prácticamente instantáneo (no hay rebuild).
5. Verificar en Sentry que los errores nuevos dejan de aparecer y en Vercel Logs que el tráfico responde con el deployment revertido.

No hay CI/CD con pasos de rollback automatizados (el único workflow en `.github/workflows/ci.yml` corre typecheck y lint, no deploya ni revierte nada).

---

## 4. Contactos / responsables

| Rol | Nombre / Teléfono |
|---|---|
| Responsable técnico (deploys, Vercel, Supabase) | `[nombre/teléfono]` |
| Responsable de pagos (Mercado Pago) | `[nombre/teléfono]` |
| Responsable de WhatsApp/Kapso | `[nombre/teléfono]` |
| Responsable en sitio (organizador / puerta) | `[nombre/teléfono]` |
| Contacto de soporte Mercado Pago | `[teléfono/canal]` |
| Contacto de soporte Vercel (si hay plan pago) | `[canal]` |

---

*Última actualización: 2026-07-02. Este documento describe el estado real del código a esa fecha — si algo cambia (ej. se agrega un endpoint de reenvío de tickets o un script `build:door-app`), actualizar este runbook.*
