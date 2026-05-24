create table boxes (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  ticket_type_id  uuid not null references ticket_types(id),
  invite_token    text unique not null,
  capacity        int not null check (capacity > 0),
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);

create table box_members (
  box_id          uuid not null references boxes(id) on delete cascade,
  profile_id      uuid not null references profiles(id),
  ticket_id       uuid references tickets(id),
  joined_at       timestamptz not null default now(),
  primary key (box_id, profile_id)
);
