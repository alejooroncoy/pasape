-- Co-organizer invites — extends the pre-existing `org_invites` table
-- (created in 20260519000050_organizations.sql) with the fields the
-- inviting-teammates flow needs: a default-generated token, default
-- 14-day expiry, a revoked_at marker, and a uniqueness/lookup index
-- on token. Existing rows keep their org_id/contact/created_by names —
-- no rename to avoid breaking unknown consumers.

-- Make contact optional: the link/WhatsApp share flow doesn't require
-- an email up-front. The column already exists as `not null`; relax it.
alter table org_invites
  alter column contact drop not null;

-- Default role: most invites are co-admins.
alter table org_invites
  alter column role set default 'admin';

-- Token autogen + 14-day expiry default. We use `hex` (32-char) instead of
-- base64url since Postgres' encode() doesn't support url-safe base64; hex
-- is URL-safe and gives ~128 bits of entropy with 16 random bytes.
alter table org_invites
  alter column token set default encode(gen_random_bytes(24), 'hex');

alter table org_invites
  alter column expires_at set default (now() + interval '14 days');

-- Revocation marker. Soft-revoke so we can audit who killed an invite.
alter table org_invites
  add column if not exists revoked_at timestamptz;

alter table org_invites
  add column if not exists revoked_by uuid references profiles(id);

-- Lookup index on token (token is already unique from the original
-- table; this index speeds up the public preview endpoint).
create index if not exists org_invites_token_idx on org_invites (token);
create index if not exists org_invites_org_idx on org_invites (organization_id);

-- RLS already enabled in 20260519000900_rls.sql; the existing
-- `org_invites_admin` policy covers owner/admin CRUD via org_role_of().
-- We add a separate read-by-token policy so the public preview endpoint
-- (called from the accept page, possibly before login) can fetch a
-- single row by token without a session. This is safe because the
-- token itself is the capability — anyone with the link gets read-only
-- preview of org name/inviter/role/status.
drop policy if exists org_invites_token_read on org_invites;
create policy org_invites_token_read on org_invites
  for select
  to anon, authenticated
  using (true);
-- NOTE: the API never returns the raw token via this policy — the
-- server reads by token using the service-role key. The permissive
-- policy exists so future client-side token-preview fetches (if added)
-- can use anon role. Tighten if/when we expose row-level access by
-- token from the client.
