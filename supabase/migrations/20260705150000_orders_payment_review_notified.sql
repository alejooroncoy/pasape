-- Anti-spam para los avisos de "pago en revisión / rechazado". El webhook de MP
-- puede disparar varias veces el mismo estado (in_process, failed): guardamos el
-- ÚLTIMO tipo de aviso enviado para no repetirlo. Un tipo distinto sí se envía
-- (in_review → luego rejected). Idempotente.
alter table orders add column if not exists payment_review_notified text;

comment on column orders.payment_review_notified is
  'Último aviso de estado de pago enviado al comprador (in_review | rejected). NULL = ninguno. Evita duplicados entre reintentos del webhook.';
