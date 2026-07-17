-- `sum(tt.capacity)` ignora los NULL en Postgres (los trata como si no
-- existieran) — con entradas ilimitadas eso hacía que el aforo total del
-- evento pareciera más chico de lo real en vez de reflejar "sin límite".
-- Si CUALQUIER tipo de entrada del evento no tiene tope, el aforo total
-- del evento pasa a ser null (sin límite) — no la suma parcial de los demás.

create or replace view event_stats_rollup as
select
  e.id as event_id,
  cap.capacity                              as capacity,
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
  'Rollup por evento: capacity (null = sin límite), sold (pagado), reserved (pending <30min), validated, revenue_cents. Fuente de los KPIs del panel — separa vendido de reservado.';
