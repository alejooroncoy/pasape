-- Why: cierre de superficie pre-piloto.
-- 1) RLS en tablas internas — solo service_role (backend) las usa.
alter table otp_throttle  enable row level security;
alter table webhook_events enable row level security;
alter table audit_log     enable row level security;

-- 2) Fijar search_path en helpers SECURITY DEFINER (lint 0011).
create or replace function public.auth_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select id from profiles
  where firebase_uid = coalesce(auth.jwt() ->> 'sub', '')
  limit 1
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from org_memberships
    where organization_id = target_org and profile_id = auth_profile_id()
  )
$$;

create or replace function public.org_role_of(target_org uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select role from org_memberships
  where organization_id = target_org and profile_id = auth_profile_id()
  limit 1
$$;

-- 3) Las helpers solo deben usarse desde RLS policies (que corren como definer),
-- no como RPC público. Verificado: src/ no las invoca vía /rest/v1/rpc.
revoke execute on function public.auth_profile_id()    from anon, authenticated, public;
revoke execute on function public.is_org_member(uuid)  from anon, authenticated, public;
revoke execute on function public.org_role_of(uuid)    from anon, authenticated, public;
