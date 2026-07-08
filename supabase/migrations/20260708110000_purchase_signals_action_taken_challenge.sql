-- Fix: el CHECK constraint original de purchase_signals.action_taken (migración
-- 20260708100000) no incluía 'would_challenge' ni 'challenge' — los valores que
-- decideEnforcement produce para el camino CENTRAL del PR (cualquier intento con
-- bot_score >= SOFT_THRESHOLD). Sin este fix, el INSERT de esos intentos viola el
-- constraint y purchaseSignalsRepo.record() lo traga silenciosamente (fail-open),
-- perdiendo exactamente la telemetría que shadow mode existe para recolectar.
--
-- Guard de existencia: idempotente si se reaplica (ver supabase-remote-drift).
do $$
begin
  if to_regclass('public.purchase_signals') is not null then
    alter table purchase_signals drop constraint if exists purchase_signals_action_taken_check;
    alter table purchase_signals
      add constraint purchase_signals_action_taken_check
      check (action_taken in (
        'logged', 'would_block', 'would_throttle', 'would_challenge',
        'throttled', 'challenge', 'blocked'
      ));
  end if;
end $$;
