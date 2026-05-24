-- Organizations (un usuario puede pertenecer a muchas; switch tipo Instagram)
create table organizations (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  logo_url        text,
  brand_color     text,
  timezone        text not null default 'America/Lima',
  -- Mercado Pago se asocia por organización en F10
  mp_account_id   text,
  created_by      uuid not null references profiles(id),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table org_memberships (
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  role            text not null check (role in ('owner','admin','editor','reporter','door')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create index org_memberships_profile_idx on org_memberships (profile_id);

-- Invitaciones por token (org_invites)
create table org_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact         text not null,          -- email o phone E.164
  role            text not null check (role in ('owner','admin','editor','reporter','door')),
  token           text unique not null,
  expires_at      timestamptz not null,
  accepted_by     uuid references profiles(id),
  accepted_at     timestamptz,
  created_by      uuid not null references profiles(id),
  created_at      timestamptz not null default now()
);

create index org_invites_contact_idx on org_invites (contact);

-- Follows del comprador hacia una organización
create table follows (
  follower_id     uuid not null references profiles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (follower_id, organization_id)
);
