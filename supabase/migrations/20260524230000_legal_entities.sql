-- Razones sociales (entidades legales) — contenedor obligatorio de marcas.
-- Modelo: productora opera 1..N razones sociales, cada una con 1..N marcas (organizations).
-- Una marca NO puede existir sin razón social (Sony → PlayStation).

create table legal_entities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                              -- "IN Punta Hermosa SAC"
  tax_id      text,                                       -- RUC opcional al inicio
  country     text not null default 'PE',
  created_by  uuid not null references profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index legal_entities_created_by_idx on legal_entities (created_by);

-- Add nullable FK first, backfill, then enforce NOT NULL.
alter table organizations add column legal_entity_id uuid references legal_entities(id) on delete restrict;

-- Backfill: agrupa orgs por (created_by, legal_name) en una sola razón social.
-- Para orgs sin legal_name: una razón social por org, con el mismo nombre.
do $$
declare
  org_rec record;
  entity_id uuid;
begin
  for org_rec in
    select id, name, legal_name, created_by
    from organizations
    where legal_entity_id is null
  loop
    entity_id := null;

    if org_rec.legal_name is not null and length(trim(org_rec.legal_name)) > 0 then
      select id into entity_id
      from legal_entities
      where created_by = org_rec.created_by
        and lower(name) = lower(trim(org_rec.legal_name))
      limit 1;
    end if;

    if entity_id is null then
      insert into legal_entities (name, created_by)
      values (
        coalesce(nullif(trim(org_rec.legal_name), ''), org_rec.name),
        org_rec.created_by
      )
      returning id into entity_id;
    end if;

    update organizations set legal_entity_id = entity_id where id = org_rec.id;
  end loop;
end $$;

alter table organizations alter column legal_entity_id set not null;

create index organizations_legal_entity_idx on organizations (legal_entity_id);

-- legal_name en organizations queda redundante. La razón social vive en legal_entities.
alter table organizations drop column legal_name;

-- Helper RLS: ¿la entidad legal pertenece al perfil actual?
create or replace function owns_legal_entity(target uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from legal_entities
    where id = target and created_by = auth_profile_id() and deleted_at is null
  )
$$;

alter table legal_entities enable row level security;

create policy legal_entities_owner_select on legal_entities
  for select using (created_by = auth_profile_id());

create policy legal_entities_owner_insert on legal_entities
  for insert with check (created_by = auth_profile_id());

create policy legal_entities_owner_update on legal_entities
  for update using (created_by = auth_profile_id());
