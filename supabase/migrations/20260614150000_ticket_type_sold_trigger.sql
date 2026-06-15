-- ticket_types.sold pasa de mantenerse a mano (4 sitios → drift) a ser derivado
-- por trigger. Fuente única = los tickets reales. Imposible desfasar.
--
-- Definición de "sold" (reservado + vendido, para disponibilidad):
--   tickets active/used, que NO sean integrantes de box (box_host_ticket_id null
--   → el host = 1 unidad de box, los amigos no suman unidades), y cuya orden
--   esté VIGENTE (pending = reserva <30min, paid = vendido). Órdenes
--   failed/expired/refunded/cancelled no ocupan aforo.

create or replace function recompute_ticket_type_sold(p_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  update public.ticket_types tt
  set sold = (
    select count(*)
    from public.tickets t
    join public.orders o on o.id = t.order_id
    where t.ticket_type_id = tt.id
      and t.status in ('active', 'used')
      and t.box_host_ticket_id is null
      and o.status in ('pending', 'paid')
  )
  where tt.id = any(p_ids);
$$;

-- Trigger en tickets: insert/void/used/delete recalcula el tipo afectado.
create or replace function sync_ticket_type_sold() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ids uuid[];
begin
  if tg_op = 'INSERT' then ids := array[new.ticket_type_id];
  elsif tg_op = 'DELETE' then ids := array[old.ticket_type_id];
  else ids := array_remove(array[new.ticket_type_id, old.ticket_type_id], null);
  end if;
  perform public.recompute_ticket_type_sold(ids);
  return null;
end $$;

drop trigger if exists tickets_sync_sold on tickets;
create trigger tickets_sync_sold
after insert or delete or update of status on tickets
for each row execute function sync_ticket_type_sold();

-- Trigger en orders: cambiar el status de una orden recalcula los tipos de sus
-- tickets (p.ej. pending→paid o pending→failed sin tocar las filas de tickets).
create or replace function sync_sold_on_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ids uuid[];
begin
  select array_agg(distinct ticket_type_id) into ids
  from public.tickets where order_id = new.id;
  if ids is not null then perform public.recompute_ticket_type_sold(ids); end if;
  return null;
end $$;

drop trigger if exists orders_sync_sold on orders;
create trigger orders_sync_sold
after update of status on orders
for each row execute function sync_sold_on_order();

-- Integridad: anular tickets que quedaron 'active' con su orden ya muerta
-- (pago falló/expiró/reembolsó) — no deben validar en puerta.
update tickets t
set status = 'void'
from orders o
where o.id = t.order_id
  and t.status = 'active'
  and o.status in ('failed', 'expired', 'refunded', 'cancelled');

-- Backfill: reconciliar todos los tipos con la nueva definición.
update ticket_types tt set sold = (
  select count(*) from tickets t join orders o on o.id = t.order_id
  where t.ticket_type_id = tt.id and t.status in ('active', 'used')
    and t.box_host_ticket_id is null and o.status in ('pending', 'paid')
);

-- El expiry ya no toca sold a mano: el void dispara el trigger.
create or replace function expire_stale_pending_orders() returns void
language sql
as $$
  with expired as (
    update orders
    set status = 'expired', updated_at = now()
    where status = 'pending'
      and created_at < now() - interval '30 minutes'
    returning id
  )
  update tickets
  set status = 'void'
  where order_id in (select id from expired)
    and status = 'active';
$$;
