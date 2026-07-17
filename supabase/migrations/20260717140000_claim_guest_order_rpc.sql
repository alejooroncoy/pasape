-- Reclamo de compra guest ATÓMICO. Antes el repo hacía dos writes separados
-- (CAS en orders.claimed_at, luego reasignar tickets); si el proceso moría entre
-- ambos, la orden quedaba reclamada pero los tickets con current_holder NULL,
-- huérfanos e irrecuperables (ni el claim idempotente ni el link los recuperaban).
-- Esta función corre ambos en UNA transacción: o los dos, o ninguno.
create or replace function claim_guest_order(p_order_id uuid, p_to_profile uuid)
returns table(claimed_ticket_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orig_holder uuid;
begin
  -- CAS: captura el holder original (subquery = valor previo al UPDATE) y gana el
  -- reclamo solo si nadie lo reclamó (claimed_at null). Un segundo reclamo
  -- concurrente matchea 0 filas.
  update orders o
     set claimed_at = now(),
         claimed_by = p_to_profile,
         buyer_id   = p_to_profile
    from (select buyer_id from orders where id = p_order_id) prev
   where o.id = p_order_id
     and o.claimed_at is null
   returning prev.buyer_id into v_orig_holder;

  if not found then
    -- Otro ya reclamó (o la orden no existe). No reasignamos nada; el caller
    -- distingue "ya reclamada por mí" (idempotente) mirando claimed_by.
    return;
  end if;

  -- Reasigna SOLO las entradas que sostenía el comprador original: NULL (modelo
  -- nuevo) o el profile-guest (legacy). `is not distinct from` cubre ambos con
  -- una sola condición y EXCLUYE a un amigo que se unió al box con su propia
  -- cuenta (current_holder propio ≠ el del comprador) — su entrada no se le roba.
  return query
    update tickets
       set current_holder = p_to_profile
     where order_id = p_order_id
       and status = 'active'
       and current_holder is not distinct from v_orig_holder
    returning id;
end;
$$;

-- Solo la service-role (backend) la invoca; nunca el cliente.
revoke all on function claim_guest_order(uuid, uuid) from public;
revoke all on function claim_guest_order(uuid, uuid) from anon;
revoke all on function claim_guest_order(uuid, uuid) from authenticated;
