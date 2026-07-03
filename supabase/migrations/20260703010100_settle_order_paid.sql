-- Liquidación atómica de una orden que Mercado Pago aprueba.
--
-- Problema (auditoría jul 2026): un pago aprobado TARDE es peligroso. El cron
-- expire_stale_pending_orders expira la orden a los 30 min y anula (void) sus
-- tickets, liberando stock. Si MP aprueba después (redirect lento de Checkout
-- Pro, Yape diferido), el webhook marcaba status='paid' pero dejaba los tickets
-- en 'void': el comprador pagaba, la orden decía "pagada", y su QR no validaba
-- en puerta. Además el stock liberado pudo revenderse (sobreventa efectiva).
--
-- Esta función hace la liquidación en UNA transacción:
--   1. Marca la orden 'paid' (necesario primero: recompute_ticket_type_sold solo
--      cuenta tickets cuya orden esté en pending/paid).
--   2. Reactiva sus tickets 'void' → 'active'. El trigger tickets_sync_sold
--      recalcula ticket_types.sold; si el stock se revendió, el constraint
--      ticket_types_sold_le_capacity (23514) ABORTA toda la función. El caller
--      trata ese caso como "pagado pero sin aforo" (reembolso manual), sin
--      entregar un QR roto.
--
-- Idempotente: si la orden ya estaba 'paid', solo refresca el snapshot de MP.
-- Devuelve el estado PREVIO de la orden ('pending' = normal, 'expired'/'failed'
-- = pago tardío reactivado, 'paid' = repetido, 'not_found' = no existe) para que
-- el webhook sepa qué ocurrió.

create or replace function settle_order_paid(
  p_order_id      uuid,
  p_paid_at       timestamptz,
  p_mp_status     text,
  p_mp_payment_id text
) returns text
language plpgsql
-- search_path fijo (hardening + convención del repo). Obliga a calificar las
-- tablas con el esquema public.
set search_path = ''
as $$
declare
  v_prev_status text;
begin
  select status into v_prev_status from public.orders where id = p_order_id for update;
  if v_prev_status is null then
    return 'not_found';
  end if;

  if v_prev_status = 'paid' then
    -- Ya liquidada: idempotente. Solo refrescamos el snapshot de MP.
    update public.orders
      set mp_status = p_mp_status, mp_payment_id = p_mp_payment_id, updated_at = now()
      where id = p_order_id;
    return 'paid';
  end if;

  update public.orders
    set status = 'paid', paid_at = p_paid_at, mp_status = p_mp_status,
        mp_payment_id = p_mp_payment_id, updated_at = now()
    where id = p_order_id;

  -- Reactiva tickets anulados por la expiración. En una orden pending normal no
  -- hay tickets 'void', así que esto no toca nada. En un pago tardío recupera las
  -- entradas; si el aforo ya no alcanza, el constraint aborta la función entera.
  update public.tickets set status = 'active'
    where order_id = p_order_id and status = 'void';

  return v_prev_status;
end $$;

-- Solo el service-role (webhook) debe ejecutarla. Supabase concede EXECUTE a
-- anon/authenticated por default privileges, así que revocar de PUBLIC no basta:
-- hay que revocar explícitamente de anon y authenticated, y re-otorgar a
-- service_role (igual que refresh_org_promoter_claim_token).
revoke all on function settle_order_paid(uuid, timestamptz, text, text) from public;
revoke execute on function settle_order_paid(uuid, timestamptz, text, text) from anon, authenticated;
grant execute on function settle_order_paid(uuid, timestamptz, text, text) to service_role;
