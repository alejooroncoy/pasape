-- Why: los reservados NO deben contar como "vendido". Hoy `ticket_types.sold`
-- mezcla reservado+pagado (se incrementa al crear la orden pending) y el panel
-- mostraba reservas como ventas. Separamos en dos frentes:
--   1) una VIEW de rollup que el reporte consume (sold=pagado, reserved=pendiente
--      no vencido) en una sola query barata.
--   2) un job pg_cron que expira las órdenes pending tras 30 min, liberando el
--      stock (tickets -> void, ticket_types.sold -= conteo).
-- `ticket_types.sold` se mantiene como contador de stock (reservado+pagado) para
-- no sobrevender; la separación vendido/reservado vive en la view y el reporte.

-- Constante de reserva: 30 minutos. Si cambia, actualizar también el cron de
-- abajo y el countdown del checkout (RESERVATION_MINUTES en el front).

-- ── VIEW de rollup por evento ────────────────────────────────────────────────
create or replace view event_stats_rollup as
select
  e.id as event_id,
  coalesce(cap.capacity, 0)::int            as capacity,
  coalesce(sold.sold, 0)::int               as sold,
  coalesce(res.reserved, 0)::int            as reserved,
  coalesce(val.validated, 0)::int           as validated,
  coalesce(rev.revenue_cents, 0)::bigint    as revenue_cents
from events e
left join (
  -- Aforo total declarado
  select tt.event_id, sum(tt.capacity) as capacity
  from ticket_types tt
  group by tt.event_id
) cap on cap.event_id = e.id
left join (
  -- Vendidas: tickets de órdenes pagadas, activos o usados (descarta void)
  select o.event_id, count(*) as sold
  from tickets t
  join orders o on o.id = t.order_id
  where o.status = 'paid' and t.status in ('active', 'used')
  group by o.event_id
) sold on sold.event_id = e.id
left join (
  -- Reservadas: tickets de órdenes pending dentro de la ventana de 30 min
  select o.event_id, count(*) as reserved
  from tickets t
  join orders o on o.id = t.order_id
  where o.status = 'pending'
    and o.created_at > now() - interval '30 minutes'
    and t.status = 'active'
  group by o.event_id
) res on res.event_id = e.id
left join (
  -- Validadas en puerta
  select event_id, count(*) as validated
  from scan_events
  where result = 'valid'
  group by event_id
) val on val.event_id = e.id
left join (
  -- Recaudado: total de órdenes pagadas
  select event_id, sum(total_cents) as revenue_cents
  from orders
  where status = 'paid'
  group by event_id
) rev on rev.event_id = e.id;

comment on view event_stats_rollup is
  'Rollup por evento: capacity, sold (pagado), reserved (pending <30min), validated, revenue_cents. Fuente de los KPIs del panel — separa vendido de reservado.';

-- ── Expiración de órdenes reservadas (30 min) ────────────────────────────────
-- Una sola sentencia con CTEs encadenadas: marca expired, anula sus tickets y
-- devuelve el stock. Las órdenes gratis nacen 'paid', nunca caen acá.
create or replace function expire_stale_pending_orders() returns void
language sql
as $$
  with expired as (
    update orders
    set status = 'expired', updated_at = now()
    where status = 'pending'
      and created_at < now() - interval '30 minutes'
    returning id
  ),
  voided as (
    update tickets
    set status = 'void'
    where order_id in (select id from expired)
      and status = 'active'
    returning ticket_type_id
  ),
  counts as (
    select ticket_type_id, count(*) as n
    from voided
    group by ticket_type_id
  )
  update ticket_types tt
  set sold = greatest(0, tt.sold - c.n)
  from counts c
  where tt.id = c.ticket_type_id;
$$;

select cron.schedule(
  'expire-stale-pending-orders',
  '* * * * *',
  $$ select expire_stale_pending_orders(); $$
);
