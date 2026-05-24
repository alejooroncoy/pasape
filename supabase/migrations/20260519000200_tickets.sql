-- Reserva temporal de stock durante el checkout
create table holds (
  id              uuid primary key default gen_random_uuid(),
  ticket_type_id  uuid not null references ticket_types(id) on delete cascade,
  buyer_id        uuid references profiles(id),
  qty             int not null check (qty > 0),
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);
create index holds_expires_idx on holds (expires_at);
create index holds_ticket_type_idx on holds (ticket_type_id);

create table orders (
  id                uuid primary key default gen_random_uuid(),
  buyer_id          uuid not null references profiles(id),
  event_id          uuid not null references events(id),
  promoter_link_id  uuid,
  status            text not null default 'pending'
                    check (status in ('pending','paid','failed','expired','refunded')),
  total_cents       int not null check (total_cents >= 0),
  currency          text not null default 'PEN',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index orders_buyer_idx on orders (buyer_id);
create index orders_event_status_idx on orders (event_id, status);

create table tickets (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  ticket_type_id  uuid not null references ticket_types(id),
  holder_name     text,
  holder_dni_last2 text,
  -- QR es un JWT firmado con la clave del evento; el opaque code es el JTI
  qr_code         text unique not null,
  status          text not null default 'active'
                  check (status in ('active','used','void','refunded')),
  used_at         timestamptz,
  current_holder  uuid not null references profiles(id),
  transfer_count  int not null default 0,
  created_at      timestamptz not null default now()
);
create index tickets_holder_idx on tickets (current_holder);
create index tickets_order_idx on tickets (order_id);

-- Auditoría de transferencias
create table ticket_transfers (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references tickets(id) on delete cascade,
  from_profile    uuid not null references profiles(id),
  to_profile      uuid references profiles(id),
  pending_token   text,
  to_contact      text,
  status          text not null default 'completed'
                  check (status in ('pending','completed','cancelled')),
  created_at      timestamptz not null default now()
);
create index ticket_transfers_ticket_idx on ticket_transfers (ticket_id);
create index ticket_transfers_pending_token_idx on ticket_transfers (pending_token);
