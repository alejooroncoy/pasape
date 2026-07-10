-- Backstop ATÓMICO del cap por instrumento de pago (tarjeta / cuenta Yape) por
-- evento. Mismo patrón que dni_event_usage (y que sold/capacity): `used` derivado
-- por trigger + CHECK `used <= cap` que aborta la transacción concurrente. Cierra
-- la carrera app-layer: dos órdenes con la misma tarjeta/Yape que pagan casi a la
-- vez se serializan en la fila de usage; la segunda choca contra el constraint.
--
-- El instrumento vive en la ORDEN (orders.card_hash / orders.yape_hash), escrito
-- PRE-COBRO por PayWithCard/PayWithYape. Ese UPDATE dispara el recompute; si deja
-- used > cap, el UPDATE falla con 23514 ANTES de llamar a MP. card_hash y
-- yape_hash comparten espacio de hash (prefijo de dominio distinto en signalHash)
-- → nunca colisionan, una sola tabla keyed por instrument_hash sirve a ambos.
--
-- cap = (max_tickets_per_person del evento, default 6) × 2. El tope por
-- instrumento es el doble del tope por persona (una familia paga varias entradas
-- con una tarjeta; un anillo de decenas de DNIs por tarjeta no). Este ×2 es la
-- fuente de verdad del cap por instrumento: se enforcea íntegramente acá.

create table if not exists instrument_event_usage (
  event_id uuid not null references events(id) on delete cascade,
  instrument_hash text not null,
  used int not null default 0,
  cap int not null,
  primary key (event_id, instrument_hash)
);

alter table instrument_event_usage enable row level security;
revoke all on instrument_event_usage from anon, authenticated;

-- Recuento derivado: entradas individuales (box_label null) de las órdenes que
-- pagaron/están pagando con este instrumento en el evento, con ticket vigente y
-- orden viva (pending/paid).
create or replace function recompute_instrument_event_usage(p_event uuid, p_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_hash is null or p_event is null then return; end if;
  insert into public.instrument_event_usage(event_id, instrument_hash, used, cap)
  values (
    p_event, p_hash, 0,
    coalesce((select max_tickets_per_person from public.events where id = p_event), 6) * 2
  )
  on conflict (event_id, instrument_hash) do nothing;
  update public.instrument_event_usage u
  set used = (
        select count(*)
        from public.tickets t
        join public.ticket_types tt on tt.id = t.ticket_type_id
        join public.orders o on o.id = t.order_id
        where tt.event_id = p_event
          and tt.box_label is null
          and (o.card_hash = p_hash or o.yape_hash = p_hash)
          and t.status in ('active', 'used')
          and o.status in ('pending', 'paid')
      ),
      cap = coalesce((select max_tickets_per_person from public.events where id = p_event), 6) * 2
  where u.event_id = p_event and u.instrument_hash = p_hash;
end $$;

-- Trigger en orders: sellar el instrumento (card_hash/yape_hash pre-cobro) o
-- cambiar el status recalcula el uso del/los instrumento(s) de esa orden. Este es
-- el punto de enforcement: el UPDATE de card_hash aborta si supera el cap.
create or replace function sync_instrument_usage_on_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.card_hash is not null then
    perform public.recompute_instrument_event_usage(new.event_id, new.card_hash);
  end if;
  if new.yape_hash is not null then
    perform public.recompute_instrument_event_usage(new.event_id, new.yape_hash);
  end if;
  if tg_op = 'UPDATE' then
    if old.card_hash is not null and old.card_hash is distinct from new.card_hash then
      perform public.recompute_instrument_event_usage(old.event_id, old.card_hash);
    end if;
    if old.yape_hash is not null and old.yape_hash is distinct from new.yape_hash then
      perform public.recompute_instrument_event_usage(old.event_id, old.yape_hash);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists orders_sync_instrument_usage on orders;
create trigger orders_sync_instrument_usage
after insert or update of card_hash, yape_hash, status on orders
for each row execute function sync_instrument_usage_on_order();

-- Trigger en tickets: void/used/insert/delete recalcula el instrumento de su
-- orden (el ticket no lo lleva; se busca en la orden).
create or replace function sync_instrument_usage_on_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_order uuid; v_event uuid; v_card text; v_yape text;
begin
  if tg_op = 'DELETE' then v_order := old.order_id; else v_order := new.order_id; end if;
  select event_id, card_hash, yape_hash into v_event, v_card, v_yape
    from public.orders where id = v_order;
  if v_card is not null then perform public.recompute_instrument_event_usage(v_event, v_card); end if;
  if v_yape is not null then perform public.recompute_instrument_event_usage(v_event, v_yape); end if;
  return null;
end $$;

drop trigger if exists tickets_sync_instrument_usage on tickets;
create trigger tickets_sync_instrument_usage
after insert or delete or update of status on tickets
for each row execute function sync_instrument_usage_on_ticket();

-- El backstop. Idempotente (guard) por el drift remoto↔migraciones.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'instrument_event_usage_used_le_cap'
  ) then
    alter table instrument_event_usage
      add constraint instrument_event_usage_used_le_cap check (used <= cap);
  end if;
end $$;

-- Endurecimiento: funciones SECURITY DEFINER, solo triggers / service-role.
revoke execute on function public.recompute_instrument_event_usage(uuid, text) from anon, authenticated, public;
revoke execute on function public.sync_instrument_usage_on_order() from anon, authenticated, public;
revoke execute on function public.sync_instrument_usage_on_ticket() from anon, authenticated, public;
