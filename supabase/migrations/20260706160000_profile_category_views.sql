-- Señal cruda de preferencia por categoría: cuenta cuántas veces (y cuándo
-- fue la última) un perfil vio eventos de cada categoría. Insumo para un
-- futuro motor de recomendaciones — PostHog guarda el detalle completo del
-- comportamiento (eventos, replay), esta tabla guarda solo el agregado que
-- el producto necesita poder leer rápido en su propio flujo (sin depender
-- de una consulta a un servicio externo en el camino crítico).
create table if not exists profile_category_views (
  profile_id     uuid not null references profiles(id) on delete cascade,
  category       text not null,
  view_count     integer not null default 1,
  last_viewed_at timestamptz not null default now(),
  primary key (profile_id, category)
);

alter table profile_category_views enable row level security;

drop policy if exists profile_category_views_self on profile_category_views;
create policy profile_category_views_self on profile_category_views
  for all using (profile_id = auth_profile_id())
  with check (profile_id = auth_profile_id());

revoke all on profile_category_views from anon;

-- Upsert atómico con incremento — evita el race de "leer view_count, sumar 1,
-- escribir" bajo vistas concurrentes del mismo perfil/categoría. Solo la
-- ejecuta el server (supabaseAdmin, service_role bypassa RLS), nunca el
-- cliente directo.
create or replace function increment_category_view(p_profile_id uuid, p_category text)
returns void
language sql
as $$
  insert into profile_category_views (profile_id, category, view_count, last_viewed_at)
  values (p_profile_id, p_category, 1, now())
  on conflict (profile_id, category)
  do update set
    view_count = profile_category_views.view_count + 1,
    last_viewed_at = now();
$$;

revoke all on function increment_category_view(uuid, text) from public;
grant execute on function increment_category_view(uuid, text) to service_role;
