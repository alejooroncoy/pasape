-- F10: Mercado Pago real flow (Bricks embebido).
-- Why: hoy `orders` se marca `paid` directo (mock). Necesitamos preference id,
-- payment id y `paid_at` para el flujo asíncrono con webhook.

alter table orders add column if not exists mp_preference_id text;
alter table orders add column if not exists mp_payment_id text;
alter table orders add column if not exists mp_status text;
alter table orders add column if not exists paid_at timestamptz;

create index if not exists orders_mp_payment_idx on orders (mp_payment_id);
create index if not exists orders_mp_preference_idx on orders (mp_preference_id);

-- Idempotencia dedicada a webhooks de Mercado Pago. La tabla genérica
-- `webhook_events` (provider+event_id) sigue existiendo; esta es específica
-- para almacenar payloads crudos y bloquear reprocesamientos.
create table if not exists mp_webhook_events (
  mp_id        text primary key,
  payload      jsonb,
  received_at  timestamptz not null default now()
);
