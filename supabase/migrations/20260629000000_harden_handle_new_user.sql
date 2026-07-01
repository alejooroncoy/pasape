-- Blindaje del login: el trigger handle_new_user no debe romper cuando el email
-- ya pertenece a OTRO profile (caso real: un profile-guest creado en el checkout
-- con el correo del comprador, que luego entra con Google con ese mismo correo).
--
-- El índice parcial `profiles_email_unique (lower(email)) where email is not null`
-- hacía que el insert del trigger lanzara unique_violation → el login con Google
-- fallaba con 500. Aquí capturamos esa violación e insertamos el profile SIN email
-- para no romper la sesión. El reclamo de la compra (claimOrder) reasigna la
-- titularidad y reconcilia el email después (libera el del guest y, si procede,
-- lo asocia a la cuenta real).

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
exception when unique_violation then
  -- Otro profile ya usa este email (p.ej. un profile-guest del checkout).
  -- No rompemos el login: creamos el profile sin email. claimOrder reconcilia.
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    null,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);
  return new;
end;
$$;
