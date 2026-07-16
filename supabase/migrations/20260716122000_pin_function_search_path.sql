-- Seguridad (auditoría jul 2026): fijar search_path en funciones SECURITY DEFINER/trigger
-- para cerrar el hijacking de search_path (advisor function_search_path_mutable).
-- Se pinnea a public (donde viven las tablas) — metadata-only, no cambia el cuerpo.
-- Guards to_regprocedure por el drift remoto↔migrations (un objeto ausente no aborta el deploy).
do $$
begin
  if to_regprocedure('public.set_tickets_updated_at()') is not null then
    execute 'alter function public.set_tickets_updated_at() set search_path = public';
  end if;
  if to_regprocedure('public.create_default_zone()') is not null then
    execute 'alter function public.create_default_zone() set search_path = public';
  end if;
  if to_regprocedure('public.increment_category_view(uuid, text)') is not null then
    execute 'alter function public.increment_category_view(uuid, text) set search_path = public';
  end if;
end $$;
