create table event_partners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  logo_url text,
  website_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index on event_partners(event_id, sort_order);

-- Solo la org dueña del evento puede gestionar partners
alter table event_partners enable row level security;

create policy "org members can manage event partners"
  on event_partners
  for all
  using (
    event_id in (
      select e.id from events e
      where is_org_member(e.organization_id)
    )
  );

create policy "anyone can read event partners"
  on event_partners
  for select
  using (true);
