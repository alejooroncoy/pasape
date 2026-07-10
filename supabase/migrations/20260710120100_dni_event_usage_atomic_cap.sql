-- Backstop ATÓMICO del cap por persona (DNI) por evento. Réplica exacta del
-- patrón sold/capacity (ver 20260702180000_ticket_type_sold_capacity_check.sql):
--
--   1. `dni_event_usage.used` es DERIVADO por trigger desde los tickets reales
--      (fuente única, imposible desfasar) — igual que ticket_types.sold.
--   2. El recompute hace un UPDATE sobre la fila (event, dni) → toma un row-lock.
--      Dos compras concurrentes del mismo DNI serializan: la segunda espera al
--      commit de la primera y recién ahí recuenta, viendo el total real.
--   3. Un CHECK (used <= cap) ABORTA la transacción entera (orden + tickets) si
--      el recuento supera el tope. Sin él, el trigger guardaría un `used`
--      inconsistente (sobrecompra silenciosa). Con él, la segunda compra
--      concurrente falla atómicamente y el caller muestra "max_per_person".
--
-- El check en TypeScript (buy()) es solo feedback temprano de UX; ESTE es el
-- backstop real. Cuenta por hash determinista holder_dni_hash (no descifra nada).
-- Solo aplica a tickets nuevos (con hash); los previos al cambio no se cuentan.

create table if not exists dni_event_usage (
  event_id uuid not null references events(id) on delete cascade,
  dni_hash text not null,
  used int not null default 0,
  cap int not null,
  primary key (event_id, dni_hash)
);

alter table dni_event_usage enable row level security;
revoke all on dni_event_usage from anon, authenticated;

-- Recuento derivado: entradas individuales (box_label null) de este DNI en el
-- evento, con ticket vigente (active/used) y orden viva (pending/paid). El cap se
-- refresca desde el evento (default 6 si el organizador no lo fijó).
create or replace function recompute_dni_event_usage(p_event uuid, p_dni_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_dni_hash is null or p_event is null then return; end if;
  insert into public.dni_event_usage(event_id, dni_hash, used, cap)
  values (
    p_event, p_dni_hash, 0,
    coalesce((select max_tickets_per_person from public.events where id = p_event), 6)
  )
  on conflict (event_id, dni_hash) do nothing;
  -- El UPDATE toma el row-lock ANTES de evaluar el subquery de conteo, así el
  -- recuento es post-lock (ve lo ya commiteado por una compra concurrente).
  update public.dni_event_usage u
  set used = (
        select count(*)
        from public.tickets t
        join public.ticket_types tt on tt.id = t.ticket_type_id
        join public.orders o on o.id = t.order_id
        where tt.event_id = p_event
          and tt.box_label is null
          and t.holder_dni_hash = p_dni_hash
          and t.status in ('active', 'used')
          and o.status in ('pending', 'paid')
      ),
      cap = coalesce((select max_tickets_per_person from public.events where id = p_event), 6)
  where u.event_id = p_event and u.dni_hash = p_dni_hash;
end $$;

-- Trigger en tickets: insert/void/used/delete o cambio de holder recalcula la(s)
-- identidad(es) afectada(s).
create or replace function sync_dni_event_usage() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_event_new uuid; v_event_old uuid;
begin
  if tg_op <> 'DELETE' and new.holder_dni_hash is not null then
    select event_id into v_event_new from public.ticket_types where id = new.ticket_type_id;
    perform public.recompute_dni_event_usage(v_event_new, new.holder_dni_hash);
  end if;
  -- En UPDATE, si el holder cambió (reasignación), recalcular también el viejo.
  if tg_op = 'UPDATE' and old.holder_dni_hash is not null
     and old.holder_dni_hash is distinct from new.holder_dni_hash then
    select event_id into v_event_old from public.ticket_types where id = old.ticket_type_id;
    perform public.recompute_dni_event_usage(v_event_old, old.holder_dni_hash);
  end if;
  if tg_op = 'DELETE' and old.holder_dni_hash is not null then
    select event_id into v_event_old from public.ticket_types where id = old.ticket_type_id;
    perform public.recompute_dni_event_usage(v_event_old, old.holder_dni_hash);
  end if;
  return null;
end $$;

drop trigger if exists tickets_sync_dni_usage on tickets;
create trigger tickets_sync_dni_usage
after insert or delete or update of status, holder_dni_hash on tickets
for each row execute function sync_dni_event_usage();

-- Trigger en orders: cambiar el status (pending→paid/failed/expired) recalcula
-- las identidades de sus tickets, aunque las filas de tickets no cambien.
create or replace function sync_dni_usage_on_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select distinct tt.event_id as ev, t.holder_dni_hash as h
    from public.tickets t
    join public.ticket_types tt on tt.id = t.ticket_type_id
    where t.order_id = new.id and t.holder_dni_hash is not null
  loop
    perform public.recompute_dni_event_usage(r.ev, r.h);
  end loop;
  return null;
end $$;

drop trigger if exists orders_sync_dni_usage on orders;
create trigger orders_sync_dni_usage
after update of status on orders
for each row execute function sync_dni_usage_on_order();

-- El backstop: aborta cualquier recompute que deje used > cap. Idempotente
-- (guard de existencia) porque el proyecto remoto está en drift con las
-- migraciones y esto podría re-correrse.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dni_event_usage_used_le_cap'
  ) then
    alter table dni_event_usage
      add constraint dni_event_usage_used_le_cap check (used <= cap);
  end if;
end $$;

-- Endurecimiento: estas funciones son SECURITY DEFINER y solo corren como
-- triggers / uso interno (service-role), nunca vía /rest/v1/rpc por anon/logueado.
revoke execute on function public.recompute_dni_event_usage(uuid, text) from anon, authenticated, public;
revoke execute on function public.sync_dni_event_usage() from anon, authenticated, public;
revoke execute on function public.sync_dni_usage_on_order() from anon, authenticated, public;
