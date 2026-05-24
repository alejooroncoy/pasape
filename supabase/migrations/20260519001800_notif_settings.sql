-- Auditoría de envíos transaccionales (email/WhatsApp/SMS) por orden.
-- Sirve para reintento manual, observabilidad y soporte.

create table if not exists notification_dispatches (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references orders(id) on delete set null,
  channel       text not null check (channel in ('email','whatsapp','sms')),
  status        text not null check (status in ('sent','failed','skipped')),
  error         text,
  dispatched_at timestamptz not null default now()
);

create index if not exists notification_dispatches_order_idx
  on notification_dispatches (order_id);
create index if not exists notification_dispatches_status_idx
  on notification_dispatches (status, dispatched_at);
