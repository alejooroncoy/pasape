# Pago tardío que ya no cabe (oversold_needs_refund)

Contexto de un error visto en Sentry el 2026-07-05. **No es un bug** — el sistema
se comportó como debía. Queda documentado para decidir el cierre operativo (auto-refund).

## Qué se vio

- **Sentry**: `JAVASCRIPT-NEXTJS-3S` — `late_payment_settlement_failed: new row for relation "ticket_types" violates check constraint "ticket_types_sold_le_capacity"`
- **Origen**: `POST /api/webhook/mp` → `HandleWebhook.ts:~206`
- **Entorno**: `development` (ngrok local), `handled: yes`, `users impacted: 0`
- **Tags**: `mp_stage: settle`, `mpStatus: approved`, `oversold: true`
- **Orden**: `2cf5fa32-bdea-43ba-8f62-01776c6c2623` · Evento Demo Pasape · **S/8** ·
  creada 04-jul 17:00 UTC · liquidación intentada 05-jul 00:05 UTC (**~7 h después**)
- **Estado final de la orden**: `status=expired`, `mp_status=approved`, `mp_payment_id=1348014729`

## Qué pasó (la carrera)

1. Se creó la orden pero no se pagó dentro de la ventana.
2. El `pg_cron` la **expiró** y **liberó el cupo**.
3. Ese cupo se **revendió** a otra persona.
4. Mercado Pago **recién ahí aprobó** el pago tardío (típico de aprobar un pago
   sandbox a mano mucho después).
5. El webhook intentó liquidar → ya no había cupo → la constraint
   `ticket_types_sold_le_capacity` **bloqueó la sobreventa**.

## Comportamiento actual (correcto)

`HandleWebhook.handleMpWebhook` → RPC `settle_order_paid`. Si la liquidación viola
la constraint de capacidad (`23514` / `sold_le_capacity`):

- **No reintenta** (reintentar no ayuda, el cupo no va a volver).
- Snapshotea `mp_status='approved'` + `mp_payment_id` sobre la orden `expired`
  → señal clara de **"pagado, requiere reembolso"**.
- Devuelve `ok({ status: "oversold_needs_refund" })` para que MP **deje de
  reintentar** el webhook.
- Reporta a Sentry (`captureException`, level=error) para que sea visible.

O sea: el sistema **se niega a sobrevender** y no deja una orden "pagada" con un
QR imposible de honrar.

## El hueco (para prod)

En este caso (dev, S/8) no hay nada que hacer. Pero si esto ocurre en
**producción** significa: **un comprador real pagó y no hay entrada** (el cupo ya
no existe). Hoy la orden solo queda *flagged* como `oversold_needs_refund`; **el
reembolso es manual** (no hay auto-refund).

Es un caso **raro**: requiere que el pago llegue tardísimo, después de que la
orden expire **y** de que el cupo se revenda. Pero es real y toca plata.

## Cómo detectar los casos (query)

```sql
select id, total_cents, mp_payment_id, updated_at
from orders
where status = 'expired' and mp_status = 'approved'
order by updated_at desc;
```

## Opciones de cierre (pendiente de decisión)

1. **Dejarlo así** + resolver el issue en Sentry cuando aparezca (es esperado y
   manejado). Reembolso manual vía panel de MP en el caso raro.
2. **Auto-refund**: en la rama `oversold`, disparar un reembolso vía la API de MP
   (`POST /v1/payments/{id}/refunds`) y notificar al comprador ("no pudimos
   confirmar tu entrada, te devolvimos el dinero"). Idempotente por `mp_payment_id`.
3. **Bajar severidad en Sentry** de `error` a `warning` para el caso `oversold`
   (sigue siendo alerta, pero no mete ruido de "error").

**Recomendación**: (1) por ahora (dev/test), y dejar (2) auto-refund anotado para
cuando se pula el flujo de pagos de producción.

## Referencias

- `src/server/payments/application/HandleWebhook.ts` (rama `mapped === "paid"`, bloque `oversold`)
- RPC `settle_order_paid` (`supabase/migrations/20260703010100_settle_order_paid.sql`)
- Constraint `ticket_types_sold_le_capacity` sobre `ticket_types`
