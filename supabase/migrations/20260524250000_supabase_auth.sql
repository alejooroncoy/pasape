-- Migración a Supabase Auth (reemplaza Firebase Auth).
-- profiles.id ahora referencia auth.users(id) 1:1.
-- Trigger handle_new_user auto-crea profiles cuando alguien se registra.

alter table profiles drop column firebase_uid;

-- profiles.id ya es uuid PK. Lo enlazamos a auth.users(id).
-- Como hicimos wipe completo, no hay datos legacy a migrar.
alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- Trigger: cuando Supabase Auth crea un user (Google OAuth, magic link, etc.)
-- inserta automáticamente la fila correspondiente en public.profiles.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- auth_profile_id() ahora retorna directamente auth.uid().
-- Las policies que dependen de esto siguen funcionando sin cambio.
create or replace function auth_profile_id() returns uuid
language sql stable security definer as $$
  select auth.uid()
$$;
