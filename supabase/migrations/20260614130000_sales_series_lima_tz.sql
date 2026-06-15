-- Dos correcciones a la serie diaria de ventas (chart "Ventas en el tiempo"):
--
-- 1) Buckets en hora de Lima (UTC-5), no UTC. Antes una venta de las 22:00 del
--    sábado (03:00 UTC del domingo) caía en el día equivocado y el punto "Hoy"
--    se corría.
-- 2) Revenue desde tickets.price_cents (precio real con promos persistido) en
--    vez de ticket_types.price_cents (precio de lista, ignoraba 2x1/preventa).

create or replace view event_sales_by_day as
select
  o.event_id,
  (t.created_at at time zone 'America/Lima')::date as day,
  count(*) as tickets_sold,
  coalesce(sum(t.price_cents), 0)::bigint as revenue_cents
from tickets t
join orders o on o.id = t.order_id
where t.status in ('active', 'used')
  and o.status = 'paid'
group by o.event_id, (t.created_at at time zone 'America/Lima')::date
order by day asc;

comment on view event_sales_by_day is
  'Tickets vendidos y revenue real (tickets.price_cents) por evento por día, en hora de Lima. Fuente del chart "Ventas en el tiempo".';
