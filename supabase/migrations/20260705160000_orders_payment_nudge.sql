-- Anti-spam del nudge proactivo "evento inminente" (job): se envía UNA vez por
-- orden cuando el evento se acerca y el pago sigue en revisión. Separado de
-- payment_review_notified (que cubre el aviso del webhook). Idempotente.
alter table orders add column if not exists payment_nudge_sent_at timestamptz;

comment on column orders.payment_nudge_sent_at is
  'Cuándo se envió el recordatorio proactivo de "evento inminente + pago en revisión". NULL = no enviado. Anti-spam del job.';
