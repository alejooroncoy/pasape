-- API keys de organizador para integraciones server-to-server (Pasape MCP:
-- que Claude/Cursor/otros agentes creen y gestionen eventos hablando en
-- lenguaje natural, en vez de pasar por la UI).
--
-- Solo se guarda el hash (SHA-256) de la key, nunca el valor en claro — mismo
-- principio que cualquier secreto de acceso. El valor en claro se muestra una
-- sola vez al crearla y no es recuperable después.
--
-- ACCESO: tabla exclusivamente server-side (service-role), igual que
-- purchase_signals / scanner_sessions. El browser nunca la lee ni escribe
-- directo — siempre a través del backend.

create table if not exists organizer_api_keys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,

  -- Nombre que el organizador le pone para reconocerla ("Claude Desktop", "Cursor del asistente").
  name text not null,

  -- Prefijo visible en UI para identificar la key sin exponerla (ej. "pk_live_8f2a...").
  key_prefix text not null,
  key_hash text not null unique,

  last_used_at timestamptz,
  revoked_at timestamptz
);

comment on table organizer_api_keys is
  'API keys de organizador para el servidor MCP de Pasape (crear eventos vía Claude/Cursor/agentes). Solo se guarda el hash; server-side only.';

create index if not exists organizer_api_keys_org_idx on organizer_api_keys (organization_id) where revoked_at is null;
create index if not exists organizer_api_keys_hash_idx on organizer_api_keys (key_hash) where revoked_at is null;

alter table organizer_api_keys enable row level security;

do $$
begin
  if to_regclass('public.organizer_api_keys') is not null then
    revoke all on table organizer_api_keys from anon, authenticated;
  end if;
end $$;
