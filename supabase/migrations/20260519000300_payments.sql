create table payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  provider        text not null default 'mercadopago',
  provider_ref    text,
  status          text not null default 'pending'
                  check (status in ('pending','authorized','paid','failed','refunded')),
  amount_cents    int not null,
  currency        text not null default 'PEN',
  raw             jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index payments_order_idx on payments (order_id);
create index payments_provider_ref_idx on payments (provider, provider_ref);

create table refunds (
  id              uuid primary key default gen_random_uuid(),
  payment_id      uuid not null references payments(id),
  amount_cents    int not null,
  reason          text,
  status          text not null default 'requested'
                  check (status in ('requested','processed','failed')),
  created_at      timestamptz not null default now(),
  processed_at    timestamptz
);

-- Idempotencia de webhooks
create table webhook_events (
  provider        text not null,
  event_id        text not null,
  payload         jsonb not null,
  processed_at    timestamptz not null default now(),
  primary key (provider, event_id)
);
