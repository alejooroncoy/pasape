-- Why: el reporte del organizador necesita una serie temporal de ventas
-- (gráfico "Ventas en el tiempo"). En vez de calcularla en cada request o
-- en el cliente, la materializamos como view sobre tickets+orders. El
-- frontend consume y filtra por rango (hoy/7d/30d/all).
--
-- Buckets: día (UTC) — es la granularidad útil para 7d/30d/all. Para "hoy"
-- el repo puede pedir bucket horario por separado si lo necesita, pero por
-- ahora el chart muestra los últimos N días con un punto por día.
--
-- Solo cuenta tickets con status 'active' o 'used' (descarta void). La
-- order debe estar 'paid' — pendientes no son ventas confirmadas.

create or replace view event_sales_by_day as
select
  o.event_id,
  date_trunc('day', t.created_at)::date as day,
  count(*) as tickets_sold,
  coalesce(sum(tt.price_cents), 0)::bigint as revenue_cents
from tickets t
join orders o on o.id = t.order_id
join ticket_types tt on tt.id = t.ticket_type_id
where t.status in ('active', 'used')
  and o.status = 'paid'
group by o.event_id, date_trunc('day', t.created_at)
order by day asc;

-- Permisos: la view hereda RLS de las tablas base. supabaseAdmin pasa por
-- service_role así que igual lo bypassea; los clientes autenticados verán
-- sólo eventos de orgs en las que tienen membership (RLS de orders).
comment on view event_sales_by_day is
  'Tickets vendidos y revenue por evento por día. Fuente para el chart de "Ventas en el tiempo" en el panel de organizador.';
