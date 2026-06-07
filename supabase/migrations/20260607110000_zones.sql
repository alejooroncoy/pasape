-- Zonas del evento como entidad de primera clase (antes era texto libre en
-- ticket_types.zone). Una zona agrupa ticket_types y es la unidad de
-- coordinación entre validadores (cada portero se liga a una zona).
--
-- Migración del texto `zone` actual:
--   - Cada evento con ticket_types recibe una zona "Principal" (is_default).
--   - Cada valor de texto `zone` distinto se convierte en su propia zona.
--   - ticket_types.zone_id apunta a la zona nombrada, o a "Principal" si era null.
-- Se conserva ticket_types.zone (texto) durante la transición; no se dropea aún.

create table zones (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  name        text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (event_id, name)
);

create index zones_event_idx on zones (event_id);

alter table ticket_types
  add column zone_id uuid references zones(id);

-- Backfill 1: zona "Principal" por defecto para cada evento que tenga ticket_types.
insert into zones (event_id, name, is_default)
select distinct tt.event_id, 'Principal', true
from ticket_types tt;

-- Backfill 2: una zona por cada valor de texto `zone` distinto (no nulo).
insert into zones (event_id, name, is_default)
select distinct tt.event_id, tt.zone, false
from ticket_types tt
where tt.zone is not null
  and tt.zone <> 'Principal'
on conflict (event_id, name) do nothing;

-- Backfill 3: ligar ticket_types con texto `zone` a su zona nombrada.
update ticket_types tt
set zone_id = z.id
from zones z
where z.event_id = tt.event_id
  and tt.zone is not null
  and z.name = tt.zone;

-- Backfill 4: ticket_types sin zona → zona "Principal" del evento.
update ticket_types tt
set zone_id = z.id
from zones z
where z.event_id = tt.event_id
  and z.is_default = true
  and tt.zone_id is null;

-- RLS: igual que ticket_types — público lee zonas de eventos publicados;
-- miembros de la org escriben.
alter table zones enable row level security;

create policy zones_public_read on zones
  for select using (
    exists(select 1 from events e where e.id = event_id and (e.status='published' or is_org_member(e.organization_id)))
  );
create policy zones_member_write on zones
  for all using (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );
