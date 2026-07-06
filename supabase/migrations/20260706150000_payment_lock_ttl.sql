-- M8: TTL en lock de pago (mp_status = 'locked') para no bloquear reintentos tras crash/red.

alter table orders add column if not exists mp_lock_expires_at timestamptz;

create or replace function acquire_order_payment_lock(
  p_order_id uuid,
  p_ttl_seconds int default 300
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  got boolean;
begin
  -- Expirar locks colgados
  update orders
  set mp_status = null, mp_lock_expires_at = null
  where id = p_order_id
    and status = 'pending'
    and mp_status = 'locked'
    and mp_lock_expires_at is not null
    and mp_lock_expires_at < now();

  update orders o
  set mp_status = 'locked',
      mp_lock_expires_at = now() + make_interval(secs => p_ttl_seconds),
      updated_at = now()
  where o.id = p_order_id
    and o.status = 'pending'
    and (
      o.mp_status is null
      or o.mp_status <> 'locked'
      or (o.mp_lock_expires_at is not null and o.mp_lock_expires_at < now())
    )
  returning true into got;

  return coalesce(got, false);
end;
$$;

revoke all on function acquire_order_payment_lock(uuid, int) from public, anon, authenticated;
