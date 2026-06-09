-- Endurecimiento de hallazgos pre-existentes del advisor de Supabase.
--
-- 1. ticket_type_presales estaba expuesta a PostgREST SIN RLS (ERROR). Espejamos
--    la RLS de ticket_types un nivel arriba vía el FK (presale → ticket_type →
--    event): lectura pública si el evento está publicado o eres miembro;
--    escritura solo para miembros de la org. El backend usa service_role, que
--    bypassa RLS, así que su operación no cambia — solo se cierra el hueco público.
--
-- 2. Funciones SECURITY DEFINER con search_path mutable (WARN): se les fija el
--    search_path (sin tocar el cuerpo) para evitar secuestro vía schemas. Se
--    incluyen los schemas que cada una referencia sin calificar.

-- ── 1. RLS de ticket_type_presales ───────────────────────────────────────────
alter table ticket_type_presales enable row level security;

drop policy if exists ticket_type_presales_public_read on ticket_type_presales;
create policy ticket_type_presales_public_read on ticket_type_presales
  for select using (
    exists (
      select 1 from ticket_types tt
      join events e on e.id = tt.event_id
      where tt.id = ticket_type_presales.ticket_type_id
        and (e.status = 'published' or is_org_member(e.organization_id))
    )
  );

drop policy if exists ticket_type_presales_member_write on ticket_type_presales;
create policy ticket_type_presales_member_write on ticket_type_presales
  for all using (
    exists (
      select 1 from ticket_types tt
      join events e on e.id = tt.event_id
      where tt.id = ticket_type_presales.ticket_type_id
        and is_org_member(e.organization_id)
    )
  ) with check (
    exists (
      select 1 from ticket_types tt
      join events e on e.id = tt.event_id
      where tt.id = ticket_type_presales.ticket_type_id
        and is_org_member(e.organization_id)
    )
  );

-- ── 2. search_path fijo en funciones SECURITY DEFINER ─────────────────────────
-- auth.uid() ya está calificado → path vacío basta.
alter function auth_profile_id() set search_path = '';
-- usan tablas públicas sin calificar (memberships, organizations, legal_entities).
alter function is_org_member(uuid) set search_path = public;
alter function org_role_of(uuid) set search_path = public;
alter function owns_legal_entity(uuid) set search_path = public;
-- usa org_promoters (public) + gen_random_bytes (extensions / pgcrypto).
alter function refresh_org_promoter_claim_token(uuid) set search_path = public, extensions;
