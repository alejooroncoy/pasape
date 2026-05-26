-- Permitir promoter_links "pendientes": el organizador agrega un promotor del pool
-- antes de que el promotor tenga cuenta Pasape. Cuando recibe su link y firma con
-- WhatsApp OTP, conectamos su profile_id al link existente.

-- 1. promoter_id pasa a nullable
alter table promoter_links alter column promoter_id drop not null;

-- 2. La constraint vieja (event_id, promoter_id) ya no aplica universalmente —
--    Postgres la nombra automáticamente, hay que descubrirla:
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'promoter_links'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) ilike '%event_id%promoter_id%';
  if con_name is not null then
    execute format('alter table promoter_links drop constraint %I', con_name);
  end if;
end$$;

-- 3. Nuevas constraints — unicidad por (evento, profile) cuando hay profile,
--    y por (evento, org_promoter) cuando viene del pool de la marca.
create unique index promoter_links_event_profile_uidx
  on promoter_links (event_id, promoter_id)
  where promoter_id is not null;

create unique index promoter_links_event_org_promoter_uidx
  on promoter_links (event_id, org_promoter_id)
  where org_promoter_id is not null;

-- 4. Constraint de integridad: al menos uno de los dos identificadores está presente.
alter table promoter_links
  add constraint promoter_links_identifier_present
  check (promoter_id is not null or org_promoter_id is not null);
