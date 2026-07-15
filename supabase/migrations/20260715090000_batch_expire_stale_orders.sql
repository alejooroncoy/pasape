-- expire_stale_pending_orders corre cada minuto (pg_cron) y hacía un
-- UPDATE sobre TODA la tabla orders filtrando status='pending' sin índice
-- de soporte ni límite de filas. Con volumen alto esto se vuelve un
-- seq scan + UPDATE masivo cada 60s, compitiendo con el resto de writes.
--
-- Fix:
-- 1) Índice parcial (solo status='pending') ordenado por created_at:
--    el cron ya no escanea la tabla completa, solo el subconjunto pending
--    en orden FIFO (las más viejas primero, que son las candidatas reales
--    a expirar).
-- 2) LIMIT + FOR UPDATE SKIP LOCKED: acota el trabajo por corrida (evita
--    un UPDATE gigante si se acumula backlog) y deja pasar filas ya
--    lockeadas por otra transacción en vez de bloquearse esperando.
--    Si el backlog supera el batch en una corrida, se termina de drenar
--    en las siguientes (corre cada minuto).
--
-- Misma lógica de expiración que 20260705140000_hold_seat_on_live_payment.sql,
-- solo se le agrega el batching. Idempotente: create or replace + index if not exists.

create index if not exists orders_pending_created_at_idx
  on orders (created_at)
  where status = 'pending';

create or replace function expire_stale_pending_orders() returns void
language sql
set search_path = public
as $$
  with expired as (
    update orders
    set status = 'expired', updated_at = now()
    where id in (
      select id
      from orders
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
      order by created_at
      limit 500
      for update skip locked
    )
    returning id
  )
  update tickets
  set status = 'void'
  where order_id in (select id from expired)
    and status = 'active';
$$;
