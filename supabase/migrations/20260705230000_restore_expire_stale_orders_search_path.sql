-- LOW-12: 20260609110000_harden_stats_security.sql fijó
-- `search_path = public` en expire_stale_pending_orders. La migración
-- posterior 20260705140000_hold_seat_on_live_payment.sql la redefinió con
-- `create or replace function ... language sql as $$ ... $$` SIN cláusula
-- `set search_path`, y CREATE OR REPLACE reemplaza toda la config de la
-- función (no la conserva) — se perdió el hardening. Volvemos a fijarlo.
-- Idempotente: alter function ... set search_path siempre sobreescribe.

alter function expire_stale_pending_orders() set search_path = public;
