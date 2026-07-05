-- Conteo canónico de "asistencia" por un link de promotor: gente que
-- EFECTIVAMENTE entró (ticket validado/usado en puerta), gratis + pago.
--
-- Complementa a promoter_sold_units (que cuenta VENDIDAS de pago). El organizador
-- elige, por esquema de metas, si los hitos se cuentan por venta (sold) o por
-- asistencia (attended). "Attended" es anti-fraude: un promotor no desbloquea un
-- bono invitando fantasmas — esos invitados tienen que aparecer y validar.
--
-- Incluye las cortesías/gratis (order de pago con total 0 igual queda 'paid'):
-- para asistencia, el gratis que ENTRA sí cuenta.
create or replace function public.promoter_attended_units(p_link_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from public.tickets t
  join public.orders o on o.id = t.order_id
  where o.promoter_link_id = p_link_id
    and o.status = 'paid'
    and t.status = 'used';
$$;

revoke all on function public.promoter_attended_units(uuid) from public;
revoke execute on function public.promoter_attended_units(uuid) from anon, authenticated;
grant execute on function public.promoter_attended_units(uuid) to service_role;
