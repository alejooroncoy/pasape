-- event_stats_rollup.capacity=null significa "sin límite" (EventCard.tsx lo
-- muestra explícitamente como "sin límite", ver comentario ahí). La versión
-- anterior (20260716100100) quitó el coalesce(...,0) para permitir ese null,
-- pero como efecto colateral un evento SIN ticket_types todavía (draft recién
-- creado, antes de agregar el primer tipo de entrada) también cae en null por
-- el LEFT JOIN sin match — quedando indistinguible de "sin límite a propósito".
-- Este fix separa los dos casos: sin ticket_types → 0, con ticket_types pero
-- alguno ilimitado → null.
--
-- También restaura `security_invoker = true` (harden_stats_security,
-- 20260609110000): CREATE OR REPLACE VIEW resetea reloptions, y la migración
-- 20260716100100 que reemplazó esta vista no lo volvió a fijar — la vista
-- quedó corriendo con los permisos del dueño en vez de los del que consulta.

create or replace view event_stats_rollup as
select
  e.id as event_id,
  case when cap.event_id is null then 0 else cap.capacity end as capacity,
  coalesce(sold.sold, 0)::int               as sold,
  coalesce(res.reserved, 0)::int            as reserved,
  coalesce(val.validated, 0)::int           as validated,
  coalesce(rev.revenue_cents, 0)::bigint    as revenue_cents
from events e
left join (
  -- Aforo total declarado. null = algún tipo de entrada es sin límite.
  select
    tt.event_id,
    case when bool_or(tt.capacity is null) then null else sum(tt.capacity)::int end as capacity
  from ticket_types tt
  group by tt.event_id
) cap on cap.event_id = e.id
left join (
  select o.event_id, count(*) as sold
  from tickets t
  join orders o on o.id = t.order_id
  where o.status = 'paid' and t.status in ('active', 'used')
  group by o.event_id
) sold on sold.event_id = e.id
left join (
  select o.event_id, count(*) as reserved
  from tickets t
  join orders o on o.id = t.order_id
  where o.status = 'pending'
    and o.created_at > now() - interval '30 minutes'
    and t.status = 'active'
  group by o.event_id
) res on res.event_id = e.id
left join (
  select event_id, count(*) as validated
  from scan_events
  where result = 'valid'
  group by event_id
) val on val.event_id = e.id
left join (
  select event_id, sum(total_cents) as revenue_cents
  from orders
  where status = 'paid'
  group by event_id
) rev on rev.event_id = e.id;

comment on view event_stats_rollup is
  'Rollup por evento: capacity (0 = sin ticket_types todavía, null = sin límite, N = tope), sold (pagado), reserved (pending <30min), validated, revenue_cents. Fuente de los KPIs del panel — separa vendido de reservado.';

alter view event_stats_rollup set (security_invoker = true);
