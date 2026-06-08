-- Códigos de acceso de evento para onboarding de porteros.
--
-- El organizador genera un código (opcionalmente atado a una zona). El portero
-- lo ingresa al unirse: el server resuelve el código → evento + zona y crea la
-- scanner_session. El código es único global para que el lookup del join sea
-- directo (no hay que saber el evento de antemano).

create table event_access_codes (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  code        text not null unique,
  zone_id     uuid references zones(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index event_access_codes_event_idx on event_access_codes (event_id);

alter table event_access_codes enable row level security;

-- Miembros de la org gestionan los códigos de sus eventos. El lookup del join lo
-- hace el server con service_role (un portero aún-no-miembro no puede leer la
-- tabla, solo canjear el código vía API).
create policy event_access_codes_member on event_access_codes
  for all using (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );
