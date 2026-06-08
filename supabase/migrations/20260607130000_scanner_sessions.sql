-- Sesiones de portero con device binding de 24h.
--
-- El portero hace login (Google) → captura nombre/DNI → ingresa el código de
-- evento (event_access_codes) → se crea una sesión ligada a (evento, profile,
-- device, zona) que expira en 24h. VerifyScanAccess valida esta sesión además
-- del membership de org. last_sync_at alimenta el banner de honestidad del
-- dashboard ("Puerta X sin sincronizar hace N min").

create table scanner_sessions (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  device_id     text not null,
  zone_id       uuid references zones(id) on delete set null,
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  last_sync_at  timestamptz,
  revoked       boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (event_id, profile_id, device_id)
);

create index scanner_sessions_event_idx on scanner_sessions (event_id);

alter table scanner_sessions enable row level security;

-- El portero ve/gestiona su propia sesión; los admins de la org ven/gestionan
-- todas las sesiones de sus eventos (para revocar).
create policy scanner_sessions_own_or_org on scanner_sessions
  for select using (
    profile_id = auth_profile_id()
    or exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );
create policy scanner_sessions_own_insert on scanner_sessions
  for insert with check (profile_id = auth_profile_id());
create policy scanner_sessions_own_update on scanner_sessions
  for update using (
    profile_id = auth_profile_id()
    or exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  ) with check (
    profile_id = auth_profile_id()
    or exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );
