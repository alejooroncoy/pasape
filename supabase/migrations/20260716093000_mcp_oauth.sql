-- Authorization server OAuth 2.1 para "Pasape MCP": deja que Claude.ai/Claude
-- Desktop/Cursor se conecten como un conector remoto normal (pegar la URL,
-- tocar "Conectar", loguearse con la cuenta de Pasape que ya tienen, aprobar).
-- Nada de API keys copy-paste para el usuario final — ver [[login-arquitectura]].
--
-- Clientes públicos (sin secreto — Dynamic Client Registration, RFC 7591) +
-- PKCE obligatorio (RFC 7636, S256) en vez de client_secret, como exige el
-- spec de MCP para conectores. code y tokens son de un solo uso / expirables.
--
-- ACCESO: todo server-side (service-role), igual que organizer_api_keys.

create table if not exists oauth_clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_name text not null,
  redirect_uris text[] not null
);

create table if not exists oauth_authorization_codes (
  code text primary key,
  created_at timestamptz not null default now(),
  client_id uuid not null references oauth_clients(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists oauth_codes_expires_idx on oauth_authorization_codes (expires_at);

create table if not exists oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references oauth_clients(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  access_token_hash text not null unique,
  refresh_token_hash text unique,
  access_expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists oauth_tokens_access_idx on oauth_tokens (access_token_hash) where revoked_at is null;
create index if not exists oauth_tokens_refresh_idx on oauth_tokens (refresh_token_hash) where revoked_at is null;

alter table oauth_clients enable row level security;
alter table oauth_authorization_codes enable row level security;
alter table oauth_tokens enable row level security;

do $$
begin
  if to_regclass('public.oauth_clients') is not null then
    revoke all on table oauth_clients from anon, authenticated;
  end if;
  if to_regclass('public.oauth_authorization_codes') is not null then
    revoke all on table oauth_authorization_codes from anon, authenticated;
  end if;
  if to_regclass('public.oauth_tokens') is not null then
    revoke all on table oauth_tokens from anon, authenticated;
  end if;
end $$;
