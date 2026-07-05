-- Aguantar el asiento mientras Mercado Pago revisa el pago (in_process).
--
-- Problema: expire_stale_pending_orders liberaba el asiento a los 30 min mirando
-- SOLO la edad de la orden. Si MP dejaba el pago en revisión manual (in_process,
-- hasta ~2 días hábiles) y aprobaba tarde, el asiento ya se había revendido →
-- viola ticket_types_sold_le_capacity (el caso oversold_needs_refund).
--
-- Fix: una orden pending con pago VIVO en revisión (mp_status = 'in_process' con
-- mp_payment_id no nulo) NO se expira a los 30 min — su asiento queda reservado
-- hasta que MP resuelva (el webhook la mueve a paid/failed). Se añade un timeout
-- largo (2 días, el máximo de MP) para no congelar inventario si MP nunca responde.
--
-- Se usa 'in_process' (revisión real), NO 'pending': el 3DS challenge queda como
-- mp_status = 'pending' y debe expirar normal si el comprador lo abandona.
--
-- ticket_types.sold ya cuenta toda orden pending vía trigger
-- (recompute_ticket_type_sold, sin filtro de tiempo), así que el asiento no se
-- revende mientras no se anulen sus tickets — que es justo lo que este cambio
-- evita. Idempotente: solo redefine la función (create or replace).

create or replace function expire_stale_pending_orders() returns void
language sql
as $$
  with expired as (
    update orders
    set status = 'expired', updated_at = now()
    where status = 'pending'
      and (
        -- Sin pago vivo en revisión: expira a los 30 min, como siempre.
        (
          created_at < now() - interval '30 minutes'
          and not (mp_status = 'in_process' and mp_payment_id is not null)
        )
        -- Con pago vivo en revisión: se aguanta hasta el timeout largo de MP.
        or (
          mp_status = 'in_process' and mp_payment_id is not null
          and created_at < now() - interval '2 days'
        )
      )
    returning id
  )
  update tickets
  set status = 'void'
  where order_id in (select id from expired)
    and status = 'active';
$$;
