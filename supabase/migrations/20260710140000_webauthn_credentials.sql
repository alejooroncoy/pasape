-- Credenciales WebAuthn (passkey) para login sin Google en dispositivos que ya
-- pasaron una vez por el código de correo. Solo accesible vía service role
-- (server) — el cliente nunca lee/escribe esta tabla directo.
--
-- profile_id referencia profiles(id), que a su vez es 1:1 con auth.users(id)
-- (ver 20260524250000_supabase_auth.sql). public_key va en base64url (no bytea):
-- @simplewebauthn/server entrega/consume Uint8Array, y lo serializamos con
-- isoBase64URL — evita el vaivén de formato hex/escape de bytea vía PostgREST.

create table if not exists webauthn_credentials (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  credential_id  text not null unique,
  public_key     text not null,
  counter        bigint not null default 0,
  device_label   text,
  transports     text[],
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz
);

create index if not exists webauthn_credentials_profile_id_idx on webauthn_credentials(profile_id);

alter table webauthn_credentials enable row level security;
revoke all on webauthn_credentials from anon, authenticated;
