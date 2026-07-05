-- LOW-4: el "token" de invitación de promotor era base64url(slug) — derivable
-- por cualquiera que conozca el slug público del evento. Pasamos a un token
-- opaco random persistido (mismo patrón que org_promoters.claim_token en
-- 20260526120000_promoter_claim_tokens.sql).

alter table events
  add column if not exists promoter_apply_token text;

-- Backfill: eventos existentes que ya tuvieran un link de invitación en uso
-- reciben un token nuevo opaco (invalida los links base64url(slug) viejos,
-- que es justo el objetivo del fix).
update events
  set promoter_apply_token = encode(gen_random_bytes(16), 'hex')
  where promoter_apply_token is null;

create unique index if not exists events_promoter_apply_token_uidx
  on events (promoter_apply_token)
  where promoter_apply_token is not null;
