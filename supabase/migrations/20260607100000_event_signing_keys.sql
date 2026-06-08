-- PKI por evento (nivel raíz) para validación offline de tickets.
--
-- Cada evento tiene un par ECDSA P-256:
--   - private_key_jwk: firma los certificados de ticket. NUNCA sale del server.
--   - public_key_jwk: el portero la cachea para verificar certs offline, sin
--     necesitar la lista de asistentes.
--
-- Reemplaza el rol del HMAC simétrico (tickets.rotation_secret) para tickets
-- nuevos. Los tickets legacy sin cert siguen validando por HMAC (coexistencia).
--
-- Tabla server-only: RLS habilitado sin policies cierra anon/authenticated;
-- service_role bypassa. La pública se sirve por API (/api/events/[slug]/signing-key),
-- nunca por lectura directa del cliente (evita exponer la privada en la misma fila).

create table event_signing_keys (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null unique references events(id) on delete cascade,
  public_key_jwk  jsonb not null,
  private_key_jwk jsonb not null,
  created_at      timestamptz not null default now()
);

alter table event_signing_keys enable row level security;
