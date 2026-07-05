-- Conteo canónico de "entradas vendidas" por un link de promotor.
--
-- Problema (auditoría jul 2026): coexistían CUATRO definiciones distintas de
-- "vendidas" — el desbloqueo de hitos contaba órdenes pagadas (incluyendo
-- gratis S/0), el home del promotor contaba órdenes pagadas SIN gratis, earnings
-- contaba filas de órdenes, y /api/r/[code]/state contaba tickets. Resultado:
-- un hito "10 entradas" se desbloqueaba con 10 COMPRAS (una compra de 3 entradas
-- contaba como 1), y la barra de progreso podía mostrar <100% en un hito ya
-- marcado "conseguido" porque usaba otro conteo.
--
-- Esta función es la ÚNICA fuente de verdad: entradas VENDIDAS = tickets
-- active/used de órdenes pagadas de PAGO (total_cents > 0). Las cortesías/gratis
-- no son "vendidas". Todos los caminos (desbloqueo de hitos, home, earnings) la
-- usan, así que el progreso y el desbloqueo nunca pueden divergir.
create or replace function public.promoter_sold_units(p_link_id uuid)
returns integer
language sql
stable
-- search_path fijo (hardening + convención del repo).
set search_path = ''
as $$
  select count(*)::int
  from public.tickets t
  join public.orders o on o.id = t.order_id
  where o.promoter_link_id = p_link_id
    and o.status = 'paid'
    and o.total_cents > 0
    and t.status in ('active', 'used');
$$;

-- Solo server-side (repos con service_role). Supabase concede EXECUTE a
-- anon/authenticated por default privileges, así que revocar de PUBLIC no basta.
revoke all on function public.promoter_sold_units(uuid) from public;
revoke execute on function public.promoter_sold_units(uuid) from anon, authenticated;
grant execute on function public.promoter_sold_units(uuid) to service_role;
