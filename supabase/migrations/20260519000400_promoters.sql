create table promoter_links (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  promoter_id     uuid not null references profiles(id),
  code            text unique not null,
  commission_pct  int not null default 0 check (commission_pct between 0 and 100),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (event_id, promoter_id)
);

create table promoter_applications (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  applicant_id    uuid not null references profiles(id),
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected','cancelled')),
  message         text,
  decided_at      timestamptz,
  decided_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  unique (event_id, applicant_id)
);

-- FK diferida ahora que existe la tabla
alter table orders
  add constraint orders_promoter_link_fk
  foreign key (promoter_link_id) references promoter_links(id);

create table payouts (
  id              uuid primary key default gen_random_uuid(),
  promoter_id     uuid not null references profiles(id),
  event_id        uuid not null references events(id),
  amount_cents    int not null,
  currency        text not null default 'PEN',
  status          text not null default 'pending'
                  check (status in ('pending','paid','void')),
  paid_at         timestamptz,
  paid_by         uuid references profiles(id),
  created_at      timestamptz not null default now()
);
