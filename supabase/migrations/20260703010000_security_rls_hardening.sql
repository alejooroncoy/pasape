-- Endurecimiento de RLS (auditoría de seguridad, jul 2026).
--
-- Tres agujeros alcanzables directamente por la Data API (PostgREST) con la
-- anon/publishable key pública:
--
--   1. org_invites: policy `USING (true)` para anon → volcado de todos los
--      tokens de invitación → toma de control de cualquier organización.
--   2. mp_webhook_events: sin RLS → lectura de payloads de pago crudos y, peor,
--      INSERT de un mp_id falso antes de que llegue el webhook real, lo que hace
--      que HandleWebhook lo trate como duplicado y descarte el pago legítimo.
--   3. notification_dispatches: sin RLS → enumeración/inserción/borrado libres.
--
-- Las tres tablas se acceden EXCLUSIVAMENTE desde el servidor con la service-role
-- key (supabaseAdmin), que bypassa RLS. Por tanto cerrar el acceso anon/auth no
-- rompe ningún flujo de la app.

-- ── 1. org_invites: eliminar la lectura pública por token ──────────────────
-- La tabla `org_invites` es legacy (el flujo vivo usa `invites`, con RLS scoped).
-- El servidor lee por token con service-role, así que esta policy permisiva solo
-- era una puerta abierta especulativa. En algunos entornos la tabla legacy ni
-- existe (el remoto ya migró a `invites`), por eso el guard de existencia.
do $$
begin
  if to_regclass('public.org_invites') is not null then
    drop policy if exists org_invites_token_read on org_invites;
  end if;
end $$;

-- ── 2. mp_webhook_events: habilitar RLS (sin policies = solo service-role) ──
alter table mp_webhook_events enable row level security;
-- Defensa en profundidad: revocar también los grants por defecto de PostgREST.
revoke all on table mp_webhook_events from anon, authenticated;

-- ── 3. notification_dispatches: habilitar RLS (solo service-role) ──────────
alter table notification_dispatches enable row level security;
revoke all on table notification_dispatches from anon, authenticated;

-- ── 4. org_promoters: ocultar el claim_token al cliente ────────────────────
-- El claim_token EMITE una sesión Supabase al reclamarse (magic-link del
-- promotor). La policy org_promoters_member_select dejaba que CUALQUIER miembro
-- de la org (incluido reporter/door, solo-lectura) leyera todas las columnas vía
-- PostgREST, incluido el token → secuestro del onboarding del promotor.
--
-- Nada en el cliente lee org_promoters directamente: todos los flujos van por
-- service-role (SupabaseOrgPromoterRepository, EventPromoterAssignment, etc.).
-- Por tanto revocamos el SELECT de cliente por completo (un revoke por-columna no
-- surte efecto mientras exista el grant de tabla). El server sigue leyendo con
-- service-role. Si en el futuro se agrega una vista de pool client-side, deberá
-- re-otorgar SELECT SOLO sobre columnas no-secretas (jamás claim_token).
revoke select on table org_promoters from anon, authenticated;
