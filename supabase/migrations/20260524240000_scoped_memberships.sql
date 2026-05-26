-- Scoped memberships e invites — modelo de productora/agencia.
-- Reemplaza org_memberships y org_invites con tablas unificadas que llevan scope.
--
-- Scope values:
--   portfolio    → scope_id = profile_id del owner del portafolio.
--                  Da acceso a TODAS las legal_entities y orgs del owner.
--   legal_entity → scope_id = legal_entities.id.
--                  Da acceso a TODAS las orgs bajo esa razón social.
--   organization → scope_id = organizations.id. (Comportamiento clásico.)

create table memberships (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  role           text not null check (role in ('owner','admin','editor','reporter','door')),
  scope_type     text not null check (scope_type in ('portfolio','legal_entity','organization')),
  scope_id       uuid not null,
  created_at     timestamptz not null default now(),
  unique (profile_id, scope_type, scope_id)
);

create index memberships_profile_idx on memberships (profile_id);
create index memberships_scope_idx on memberships (scope_type, scope_id);

create table invites (
  id             uuid primary key default gen_random_uuid(),
  invited_by     uuid not null references profiles(id) on delete restrict,
  email          text,
  role           text not null check (role in ('admin','editor','reporter','door')),
  scope_type     text not null check (scope_type in ('portfolio','legal_entity','organization')),
  scope_id       uuid not null,
  token          text unique not null default encode(gen_random_bytes(24), 'hex'),
  expires_at     timestamptz not null default (now() + interval '14 days'),
  accepted_at    timestamptz,
  accepted_by    uuid references profiles(id),
  revoked_at     timestamptz,
  created_at     timestamptz not null default now()
);

create index invites_scope_idx on invites (scope_type, scope_id);
create index invites_invited_by_idx on invites (invited_by);

-- Backfill memberships desde org_memberships (todas eran org-scope).
insert into memberships (profile_id, role, scope_type, scope_id, created_at)
select profile_id, role, 'organization', organization_id, created_at
from org_memberships;

-- Backfill invites desde org_invites (todas eran org-scope).
-- org_invites usa columnas: contact, role, token, expires_at, accepted_by, accepted_at, created_by, created_at
insert into invites (invited_by, email, role, scope_type, scope_id, token, expires_at, accepted_at, accepted_by, created_at)
select
  created_by,
  case when contact ~ '@' then contact else null end,
  role,
  'organization',
  organization_id,
  token,
  expires_at,
  accepted_at,
  accepted_by,
  created_at
from org_invites;

-- Drop tablas viejas (sin usuarios reales aún → safe).
drop table org_invites;
drop table org_memberships;

-- =================== RLS helpers ===================

-- ¿el caller tiene acceso a la org (por cualquier scope)?
create or replace function is_org_member(target_org uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1
    from memberships m
    join organizations o on o.id = target_org
    join legal_entities le on le.id = o.legal_entity_id
    where m.profile_id = auth_profile_id()
      and (
        (m.scope_type = 'organization' and m.scope_id = o.id)
        or (m.scope_type = 'legal_entity' and m.scope_id = le.id)
        or (m.scope_type = 'portfolio'    and m.scope_id = le.created_by)
      )
  )
$$;

-- Devuelve el rol del caller en una org, priorizando el scope más específico.
create or replace function org_role_of(target_org uuid) returns text
language sql stable security definer as $$
  select m.role
  from memberships m
  join organizations o on o.id = target_org
  join legal_entities le on le.id = o.legal_entity_id
  where m.profile_id = auth_profile_id()
    and (
      (m.scope_type = 'organization' and m.scope_id = o.id)
      or (m.scope_type = 'legal_entity' and m.scope_id = le.id)
      or (m.scope_type = 'portfolio'    and m.scope_id = le.created_by)
    )
  order by case m.scope_type
    when 'organization' then 1
    when 'legal_entity' then 2
    when 'portfolio'    then 3
  end
  limit 1
$$;

-- =================== RLS policies ===================

alter table memberships enable row level security;
alter table invites     enable row level security;

-- memberships: el caller ve sus propias filas + las filas de cualquier scope que controle.
create policy memberships_self_select on memberships
  for select using (profile_id = auth_profile_id());

-- Owner del portfolio/legal_entity/org puede ver, crear y borrar memberships en sus scopes.
create policy memberships_owner_select on memberships
  for select using (
    (scope_type = 'portfolio'    and scope_id = auth_profile_id())
    or (scope_type = 'legal_entity' and owns_legal_entity(scope_id))
    or (scope_type = 'organization' and is_org_member(scope_id))
  );

create policy memberships_owner_insert on memberships
  for insert with check (
    (scope_type = 'portfolio'    and scope_id = auth_profile_id())
    or (scope_type = 'legal_entity' and owns_legal_entity(scope_id))
    or (scope_type = 'organization' and org_role_of(scope_id) in ('owner','admin'))
  );

create policy memberships_owner_delete on memberships
  for delete using (
    (scope_type = 'portfolio'    and scope_id = auth_profile_id())
    or (scope_type = 'legal_entity' and owns_legal_entity(scope_id))
    or (scope_type = 'organization' and org_role_of(scope_id) in ('owner','admin'))
  );

-- invites: similar — el creador/owner del scope los ve y administra.
create policy invites_inviter_select on invites
  for select using (
    invited_by = auth_profile_id()
    or (scope_type = 'portfolio'    and scope_id = auth_profile_id())
    or (scope_type = 'legal_entity' and owns_legal_entity(scope_id))
    or (scope_type = 'organization' and org_role_of(scope_id) in ('owner','admin'))
  );

create policy invites_inviter_insert on invites
  for insert with check (
    invited_by = auth_profile_id()
    and (
      (scope_type = 'portfolio'    and scope_id = auth_profile_id())
      or (scope_type = 'legal_entity' and owns_legal_entity(scope_id))
      or (scope_type = 'organization' and org_role_of(scope_id) in ('owner','admin'))
    )
  );

create policy invites_inviter_update on invites
  for update using (
    invited_by = auth_profile_id()
    or (scope_type = 'portfolio'    and scope_id = auth_profile_id())
    or (scope_type = 'legal_entity' and owns_legal_entity(scope_id))
    or (scope_type = 'organization' and org_role_of(scope_id) in ('owner','admin'))
  );
