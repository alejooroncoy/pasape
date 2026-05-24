create table scan_events (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid references tickets(id),
  event_id        uuid not null references events(id),
  scanned_by      uuid not null references profiles(id),
  result          text not null check (result in ('valid','already_used','invalid','void','unknown_event')),
  scanned_at      timestamptz not null default now(),
  raw_token       text
);
create index scan_events_event_idx on scan_events (event_id, scanned_at);
