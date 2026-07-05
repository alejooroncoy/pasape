-- Endurecimiento de RLS de scanner_sessions (auditoría de seguridad, jul 2026).
--
-- Agujero CRÍTICO alcanzable directamente por la Data API (PostgREST) con la
-- publishable/anon key pública:
--
--   La policy de INSERT `scanner_sessions_own_insert` solo valida
--   `with check (profile_id = auth_profile_id())`: NO exige membership de la org
--   ni relación con el event_id. Supabase concede por default INSERT/SELECT a
--   `authenticated` sobre tablas de `public`. Como la columna `token` es
--   escribible por el cliente, cualquier usuario logueado con Google podía
--   auto-emitirse una sesión de portero para CUALQUIER evento:
--     POST /rest/v1/scanner_sessions { event_id, profile_id:<su uid>,
--                                       device_id, token:'atk', expires_at:futuro }
--   y luego escanear con header x-door-token → fuga masiva de PII de asistentes
--   (holder_name, dni_last4, qr_code) y quema/admisión de entradas ajenas.
--
-- Todos los flujos legítimos de scanner_sessions se ejecutan server-side con la
-- service-role key (supabaseAdmin), que bypassa RLS:
--   - JoinByCode (canje de código) crea/extiende la sesión y su token.
--   - ScannerSessions / SupabaseEventRepository leen y actualizan por service-role.
-- El cliente browser NUNCA escribe ni lee esta tabla directamente. Por tanto
-- revocar los grants de anon/authenticated no rompe ningún flujo de la app y
-- cierra el agujero de raíz (mismo patrón que mp_webhook_events,
-- notification_dispatches y org_promoters en 20260703010000).

-- ── 1. Revocar los grants por defecto de PostgREST (defensa en profundidad) ──
-- Idempotente: revoke es no-op si el grant ya no existe. Guard de existencia por
-- si el remoto estuviera en drift respecto a estas migraciones.
do $$
begin
  if to_regclass('public.scanner_sessions') is not null then
    revoke all on table scanner_sessions from anon, authenticated;
  end if;
end $$;

-- ── 2. Eliminar las policies pensadas para acceso de cliente ────────────────
-- Sin grants de cliente, estas policies ya no conceden nada; se eliminan para
-- que no vuelvan a habilitar acceso si algún futuro grant se re-otorgara por
-- error. Todo el acceso legítimo es server-side (service-role bypassa RLS y no
-- depende de policies).
do $$
begin
  if to_regclass('public.scanner_sessions') is not null then
    drop policy if exists scanner_sessions_own_insert on scanner_sessions;
    drop policy if exists scanner_sessions_own_update on scanner_sessions;
    drop policy if exists scanner_sessions_own_or_org on scanner_sessions;
  end if;
end $$;
