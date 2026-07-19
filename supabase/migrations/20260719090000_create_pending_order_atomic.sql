-- Crear una orden pending y sus tickets es una única decisión de inventario.
--
-- Antes el backend hacía INSERT orders y luego INSERT tickets en dos requests
-- PostgREST independientes. Si el segundo fallaba por stock o por un corte de
-- red, quedaba una orden pending sin entradas hasta que el cron la limpiara.
-- Esta RPC conserva la lógica de pricing en la capa de aplicación, pero hace
-- atómica la persistencia que reserva cupo: o nacen orden + tickets juntos, o
-- no nace nada.

create or replace function create_pending_order_with_tickets(
  p_order jsonb,
  p_tickets jsonb,
  p_promoter_effective_quota integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_tickets jsonb;
  v_requested_units integer;
  v_used_units integer;
  v_promoter_link_id uuid;
  v_initial_status text;
  v_ticket_status text;
begin
  if jsonb_typeof(p_tickets) <> 'array' or jsonb_array_length(p_tickets) = 0 then
    raise exception 'tickets_required' using errcode = 'P0001';
  end if;

  if nullif(p_order->>'event_id', '') is null then
    raise exception 'event_required' using errcode = 'P0001';
  end if;

  -- El backend ya verificó precio, venta y ticket type. Esta comprobación evita
  -- que un payload inconsistente pueda asociar una entrada de otro evento a la
  -- orden, incluso si en el futuro se reutiliza esta RPC desde otro caller.
  if exists (
    select 1
    from jsonb_to_recordset(p_tickets) as t(ticket_type_id uuid)
    left join public.ticket_types tt on tt.id = t.ticket_type_id
    where tt.id is null or tt.event_id <> (p_order->>'event_id')::uuid
  ) then
    raise exception 'ticket_type_event_mismatch' using errcode = 'P0001';
  end if;

  v_promoter_link_id := nullif(p_order->>'promoter_link_id', '')::uuid;
  v_requested_units := jsonb_array_length(p_tickets);
  v_initial_status := coalesce(nullif(p_order->>'initial_status', ''), 'pending');
  if v_initial_status not in ('pending', 'pending_approval') then
    raise exception 'invalid_initial_order_status' using errcode = 'P0001';
  end if;
  v_ticket_status := case when v_initial_status = 'pending_approval' then 'pending_approval' else 'active' end;

  -- Una fila de promotor es el punto de serialización de su cuota. Así dos
  -- compras simultáneas con el mismo código no pueden pasar ambas el conteo.
  if v_promoter_link_id is not null and p_promoter_effective_quota is not null then
    perform 1
    from public.promoter_links
    where id = v_promoter_link_id
    for update;

    select count(*)::integer
      into v_used_units
      from public.tickets t
      join public.orders o on o.id = t.order_id
     where o.promoter_link_id = v_promoter_link_id
       and o.status in ('pending', 'paid')
       and t.status in ('active', 'used');

    if coalesce(v_used_units, 0) + v_requested_units > p_promoter_effective_quota then
      raise exception 'promoter_quota_exceeded' using errcode = 'P0001';
    end if;
  end if;

  insert into public.orders (
    buyer_id,
    event_id,
    promoter_link_id,
    status,
    total_cents,
    service_fee_cents,
    currency,
    guest_email,
    guest_phone,
    guest_name,
    guest_dni,
    guest_dni_enc,
    guest_dni_last4,
    is_courtesy,
    custom_field_answers
  ) values (
    nullif(p_order->>'buyer_id', '')::uuid,
    (p_order->>'event_id')::uuid,
    v_promoter_link_id,
    v_initial_status,
    (p_order->>'total_cents')::integer,
    coalesce((p_order->>'service_fee_cents')::integer, 0),
    coalesce(nullif(p_order->>'currency', ''), 'PEN'),
    nullif(p_order->>'guest_email', ''),
    nullif(p_order->>'guest_phone', ''),
    nullif(p_order->>'guest_name', ''),
    null,
    nullif(p_order->>'guest_dni_enc', ''),
    nullif(p_order->>'guest_dni_last4', ''),
    coalesce((p_order->>'is_courtesy')::boolean, false),
    coalesce(p_order->'custom_field_answers', '{}'::jsonb)
  )
  returning * into v_order;

  insert into public.tickets (
    order_id,
    ticket_type_id,
    status,
    price_cents,
    custom_field_answers,
    holder_name,
    holder_email,
    holder_phone,
    holder_email_enc,
    holder_phone_enc,
    holder_dni_last2,
    holder_dni_enc,
    holder_dni_last4,
    holder_dni_hash,
    qr_code,
    current_holder,
    box_label,
    box_host_ticket_id
  )
  select
    v_order.id,
    t.ticket_type_id,
    v_ticket_status,
    t.price_cents,
    coalesce(t.custom_field_answers, '{}'::jsonb),
    t.holder_name,
    t.holder_email,
    t.holder_phone,
    t.holder_email_enc,
    t.holder_phone_enc,
    t.holder_dni_last2,
    t.holder_dni_enc,
    t.holder_dni_last4,
    t.holder_dni_hash,
    t.qr_code,
    t.current_holder,
    t.box_label,
    null
  from jsonb_to_recordset(p_tickets) as t(
    ticket_type_id uuid,
    price_cents integer,
    custom_field_answers jsonb,
    holder_name text,
    holder_email text,
    holder_phone text,
    holder_email_enc text,
    holder_phone_enc text,
    holder_dni_last2 text,
    holder_dni_enc text,
    holder_dni_last4 text,
    holder_dni_hash text,
    qr_code text,
    current_holder uuid,
    box_label text
  );

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    into v_tickets
    from public.tickets t
   where t.order_id = v_order.id;

  return jsonb_build_object('order', to_jsonb(v_order), 'tickets', v_tickets);
end;
$$;

revoke all on function create_pending_order_with_tickets(jsonb, jsonb, integer) from public;
revoke all on function create_pending_order_with_tickets(jsonb, jsonb, integer) from anon;
revoke all on function create_pending_order_with_tickets(jsonb, jsonb, integer) from authenticated;
grant execute on function create_pending_order_with_tickets(jsonb, jsonb, integer) to service_role;
