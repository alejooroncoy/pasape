-- Rotation secret por ticket. Se usa para generar códigos QR rotantes
-- (HMAC-SHA256(secret, ticket_id|window10s)) que el escáner valida sin que el
-- secreto deje el servidor. El qr_code estático sigue siendo el identificador
-- canónico para transfers/recovery/audit.

alter table tickets
  add column rotation_secret bytea;

-- Backfill tickets existentes con un secret random
update tickets
set rotation_secret = decode(encode(gen_random_bytes(32), 'hex'), 'hex')
where rotation_secret is null;

alter table tickets
  alter column rotation_secret set not null,
  alter column rotation_secret set default decode(encode(gen_random_bytes(32), 'hex'), 'hex');

-- Anti-replay: track el último window consumido. Si un atacante intenta
-- reusar un código del mismo window, lo rechazamos.
alter table tickets
  add column last_used_window bigint;
