# Refactor: cortesía como ticket real (retirar `kind='invitation'`)

> Estado: **ejecutado (2026-06-21).** Migración `20260621130000_courtesy_on_real_ticket_type.sql` + cambios de backend/tipos aplicados; falta correr `vitest` y smoke manual. Objetivo: que una cortesía sea un **ticket gratis de una entrada real** (reutilizando la General/VIP que ya existe) en vez de un tipo oculto `invitation`. Valida el modelo de mercado (Posh tracking links + cortesías; FourVenues). Ver memoria `guest-list-feature`.

## Por qué

`kind='invitation'` mete un **tipo de catálogo que el organizador nunca creó**. Si quieres una cortesía "VIP", hoy entra como "Invitación" genérica — pierde la identidad de la entrada y obliga a lógica paralela. El modelo correcto: **la cortesía reutiliza la entrada real, marcada como gratis y atribuida al promotor**.

## Lo que YA está bien (no se toca)

- **Atribución** vive en `orders.promoter_link_id` — sirve para ventas y cortesías.
- **Precio** vive en `orders.total_cents` — venta (>0) vs cortesía (=0). `getHomeData` ya separa así.
- La app del promotor (`/promo`, `/promo/[slug]/guests`) y su UX no cambian.

## Modelo objetivo

```
Cortesía = ticket sobre una entrada REAL (kind general/box)
         + tickets.is_courtesy = true
         + order.total_cents = 0
         + order.promoter_link_id = <link del promotor>
```
- Entra como esa entrada (General real), gratis.
- **No consume stock vendible** de esa entrada (el trigger de `sold` la excluye).
- **Sí cuenta en el aforo** del evento.
- Se identifica por instancia (`is_courtesy`), nunca por un `kind` aparte.

## Pasos

### 1. DB — columna + trigger + migración (una sola migration)
Archivo: `supabase/migrations/<ts>_courtesy_on_real_ticket_type.sql`
1. `alter table tickets add column is_courtesy boolean not null default false;`
2. **Backfill:** marcar cortesías existentes y re-apuntarlas a una entrada real:
   - `is_courtesy = true` para tickets cuyo `ticket_type.kind = 'invitation'` **o** cuya orden tiene `total_cents = 0` con `promoter_link_id`.
   - Re-apuntar esos tickets a la entrada general del mismo evento (la más barata/activa). Si el evento no tiene general, crear una mínima o dejar el tipo y solo marcar (decidir en ejecución; preferir re-apuntar).
3. **Trigger `sold`:** revisar `20260614150000_ticket_type_sold_trigger.sql` y excluir `is_courtesy = true` del conteo de `ticket_types.sold`. (Las cortesías no agotan la entrada.)
4. Borrar los `ticket_types` con `kind='invitation'` que queden sin tickets.
5. CHECK: `check (kind in ('general','box'))`.

### 2. Backend — emitir cortesía sobre entrada real
- `src/server/promoters/application/GuestList.ts`:
  - Quitar `eventRepo.ensureInvitationTicketType(...)`.
  - Resolver la **entrada general destino** del evento (helper nuevo en EventRepository, ej. `getDefaultGeneralTicketType(eventId)` → la general activa más barata).
  - `ticketRepo.buy({ ... items:[{ ticketTypeId: general.id, qty:1, ... }], promoCode: link.code, courtesy: true })`.
- `src/server/tickets/...` (`buy`): aceptar `courtesy?: boolean`; cuando true, emitir tickets con `is_courtesy = true` y precio 0 (la orden ya queda total 0). Verificar que el path `buy:free` siga marcando la orden paid + dispatch del QR.

### 3. Backend — identificar cortesías por instancia
- `SupabasePromoterRepository.listGuests`: cambiar filtro `ticket_type.kind='invitation'` → `tickets.is_courtesy = true` (join sigue por `order.promoter_link_id`).
- `SupabaseEventRepository`:
  - Quitar `ensureInvitationTicketType` + su entrada en el puerto/`EventRepository`.
  - Quitar los `.neq("kind","invitation")` del listado público (ya no hace falta: las cortesías son tickets, no tipos; ningún tipo `invitation` existirá).
  - Reportes/`ExportEventReport` ("Invitados (cortesías)"): contar por `is_courtesy`/orden total 0.
- `EventRepository` port: remover `ensureInvitationTicketType` y el doc de invitation.

### 4. Enum / tipos
- `TicketTypeKind` ya está en `'general' | 'box' | 'invitation'` → dejar `'general' | 'box'`.
- `toTicketType`: simplificar (ya no existe invitation; box vs general).
- Buscar y limpiar referencias a `invitation` (composer `Exclude<,"invitation">` queda redundante pero inocuo; revisar).

### 5. Verificación
- `tsc --noEmit` limpio.
- `vitest run` verde.
- Smoke manual: promotor agrega invitado en `/promo` → entra como General gratis, aparece en su lista, cuenta en aforo, NO descuenta stock de General; reporte lo muestra como cortesía con 0 ingreso.

## Decisiones tomadas
- Cortesía **reutiliza** la entrada real (no tipo nuevo). ✅
- Cupo: **Opción B (por promotor)** — pero la config rica va en **Fase 2** (composer: modo gratis-hasta-X + cupo por promotor + dashboard). En esta fase el promotor sigue agregando igual; default = entrada general del evento.
- Cortesías **cuentan en el aforo de su entrada** (ocupan cupo físico, respetan `capacity`, no sobrevenden el espacio). Se liberan solas al anularse (trigger). La separación venta/cortesía para **ingresos** vive en `orders.total_cents`, no en el aforo.

## Fuera de alcance (Fase 2)
- Config en el composer (toggle, modo gratis/reducida/pago-puerta, cupo por promotor). Mockups: `mockups/composer-guestlist.html`, `mockups/guest-list-demo.html`.
- UI de check-in en puerta estilo Luma/Partiful (tabs Going/Checked-in).

## Riesgos
- **Trigger de `sold`:** probar que excluir cortesías no rompe el stock de ventas reales.
- **Migración de datos:** re-apuntar tickets `invitation` a una general real — validar que cada evento con cortesías tenga una general destino.
- Es cambio de **tipo core + DB**: va en el PR grande, con tests de red.
