-- Pool de promotores a nivel marca (organization).
-- El organizador agrega promotores una vez en su brand con nombre + WhatsApp + % default.
-- Al crear/editar un evento, selecciona del pool y se genera un promoter_link por evento.
--
-- profile_id es nullable: el promotor existe en el pool antes de tener cuenta Pasape.
-- Cuando recibe su link y firma con OTP, conectamos su profile_id al org_promoter.

create table org_promoters (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references organizations(id) on delete cascade,
  name                     text not null,
  whatsapp                 text,
  default_commission_pct   int not null default 15 check (default_commission_pct between 0 and 100),
  profile_id               uuid references profiles(id) on delete set null,
  notes                    text,
  created_by               uuid not null references profiles(id) on delete restrict,
  created_at               timestamptz not null default now(),
  deleted_at               timestamptz
);

create index org_promoters_org_idx
  on org_promoters (organization_id)
  where deleted_at is null;

create index org_promoters_profile_idx
  on org_promoters (profile_id)
  where profile_id is not null and deleted_at is null;

-- Un mismo WhatsApp no se duplica dentro de la misma org (solo activos).
create unique index org_promoters_unique_whatsapp
  on org_promoters (organization_id, whatsapp)
  where whatsapp is not null and deleted_at is null;

-- Trace de qué promoter del brand generó cada promoter_link (nullable: legacy links).
alter table promoter_links
  add column org_promoter_id uuid references org_promoters(id) on delete set null;

create index promoter_links_org_promoter_idx
  on promoter_links (org_promoter_id)
  where org_promoter_id is not null;

-- =================== RLS ===================

alter table org_promoters enable row level security;

-- Lectura: cualquier miembro de la org puede ver el pool.
create policy org_promoters_member_select on org_promoters
  for select using (is_org_member(organization_id));

-- Insertar/editar/borrar: solo owner/admin/editor de la org.
create policy org_promoters_admin_insert on org_promoters
  for insert with check (
    org_role_of(organization_id) in ('owner','admin','editor')
    and created_by = auth_profile_id()
  );

create policy org_promoters_admin_update on org_promoters
  for update using (
    org_role_of(organization_id) in ('owner','admin','editor')
  );

create policy org_promoters_admin_delete on org_promoters
  for delete using (
    org_role_of(organization_id) in ('owner','admin')
  );
