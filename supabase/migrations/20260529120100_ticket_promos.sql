-- Promociones 2x1 / 3x2 por entrada. Sección aparte de la preventa.
create table ticket_promos (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  ticket_type_id  uuid not null references ticket_types(id) on delete cascade,
  kind            text not null check (kind in ('2x1','3x2')),
  ends_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index ticket_promos_event_idx on ticket_promos (event_id);
create index ticket_promos_ticket_type_idx on ticket_promos (ticket_type_id);

alter table ticket_promos enable row level security;

-- Público lee promos de eventos publicados; la org ve las suyas. (Espeja la
-- policy de ticket_types en 20260519000900_rls.sql.)
create policy ticket_promos_public_read on ticket_promos
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (e.status = 'published' or is_org_member(e.organization_id))
    )
  );

create policy ticket_promos_member_write on ticket_promos
  for all using (
    exists (select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );
