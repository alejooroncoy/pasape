# Plan — Checkout en bottom-sheet (datos sobre el evento)

> Estado: **en implementación** (jul 2026). El paso de datos se muestra en una
> hoja sobre el evento; el pago se queda en superficie dedicada por seguridad.

## Objetivo

Que **elegir → dar datos → (gratis) tener el QR** ocurra **sin salto de página**.
Sensación app-nativa, coherente con la hoja de boxes. Nada que se sienta template.

## Principios

- **Datos = hoja** que sube sobre el evento (flyer difuminado detrás = identidad viva).
- **Pago = superficie dedicada** (Mercado Pago + 3DS son frágiles; el drawer no debe
  pelear con el iframe del banco). Prioridad del usuario: facilidad + rapidez + **seguridad**.
- **No duplicar** la lógica de `buy/page.tsx`: extraer las piezas y reusarlas.

## Flujo

| Caso | En la hoja | Al confirmar |
|---|---|---|
| **Evento gratis** | datos (¿Quién va?) | "Confirmar" → `buy.mutateAsync` → `/processing` (QR). Cero navegación. |
| **Evento pagado** | datos (¿Quién va?) | "Ir a pagar" → crea orden reservada → entrega a `/buy?order=id` (resume → pago). Sin PII en la URL. |

## Pasos

1. **Extraer el form a un módulo compartido** — `events/[slug]/_checkout/`
   - Mover `DataPhase`, `Section`, `Field`, input de teléfono E.164 y sanitizers
     desde `buy/page.tsx`. `buy/page.tsx` los importa (sin cambio de comportamiento).
   - *Paso mecánico y seguro.*

2. **`CheckoutSheet` (nuevo)** — reusa el patrón drag-to-dismiss del `BoxPickerSheet`.
   - Fondo: flyer difuminado + scrim. Header arrastrable.
   - Resumen compacto del pedido + total (`useOrderQuote`).
   - Form de datos con autofill si hay sesión (`useCurrentUser`).
   - Estado propio: `name / dni / phone / email / isForeigner` + validación (la misma del `/buy`).

3. **Wiring en el evento** — `goBuy()` con selección abre el sheet (ya no navega).
   - Gratis → confirma en la hoja.
   - Pagado → crea orden reservada y entrega al pago seguro.

4. **`/buy`** queda como superficie de pago + fallback deep-link (ya arranca en datos/pago).

## Alcance / no-alcance

- ✅ Datos en hoja; gratis se completa en hoja; pagado entrega al pago seguro.
- ❌ Campos de MP / 3DS dentro del drawer (fuera de alcance por seguridad).

## Riesgos

- No derivar la fórmula de precio ni la validación (reusar los módulos únicos).
- La creación de orden reservada (pagado) debe ser idempotente — reusar el guard
  `paymentInFlightRef` que ya evita el doble `startPayment`.

## Contexto previo (ya hecho)

- Paso de selección repetido en `/buy` eliminado (el selector vive solo en el detalle).
- Toast "elige alguna entrada" + scroll al selector cuando se compra sin elegir.
- Fix del chip "Box Box" + animación de quitar más fluida.
