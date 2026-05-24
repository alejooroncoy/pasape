create table events (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text unique not null,
  organization_id           uuid not null references organizations(id),
  created_by                uuid not null references profiles(id),
  title                     text not null,
  description               text,
  venue                     text,
  cover_url                 text,
  starts_at                 timestamptz not null,
  ends_at                   timestamptz,
  timezone                  text not null default 'America/Lima',
  status                    text not null default 'draft'
                            check (status in ('draft','published','closed','cancelled')),
  -- Capacity policy
  total_capacity            int,
  overbook_pct              int not null default 0 check (overbook_pct between 0 and 100),
  -- Transfer policy
  transfers_enabled         boolean not null default true,
  transfer_deadline_hours   int,
  transfer_max_count        int not null default 1,
  transfer_requires_kyc     boolean not null default false,
  -- Optimistic locking
  version                   int not null default 1,
  created_at                timestamptz not null default now(),
  deleted_at                timestamptz
);

create index events_org_status_idx on events (organization_id, status);
create index events_starts_at_idx on events (starts_at);
create index events_title_trgm on events using gin (title gin_trgm_ops);
create index events_venue_trgm on events using gin (venue gin_trgm_ops);

-- Staff puntual (no miembros de la org): portero externo, editor para una noche, etc.
create table event_staff (
  event_id        uuid not null references events(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  role            text not null check (role in ('door','editor','reporter')),
  created_at      timestamptz not null default now(),
  primary key (event_id, profile_id)
);

-- Co-organizadores (invitados que comparten visibilidad/ediciones)
create table event_co_organizers (
  event_id        uuid not null references events(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (event_id, profile_id)
);

-- Ticket types
create table ticket_types (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  name            text not null,
  kind            text not null default 'general' check (kind in ('general','vip','box')),
  price_cents     int not null check (price_cents >= 0),
  currency        text not null default 'PEN',
  capacity        int not null check (capacity >= 0),
  sold            int not null default 0 check (sold >= 0),
  position        int not null default 0,
  version         int not null default 1,
  created_at      timestamptz not null default now()
);

create index ticket_types_event_idx on ticket_types (event_id);
