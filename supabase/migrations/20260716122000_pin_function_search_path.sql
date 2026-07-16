-- Seguridad (auditoría jul 2026): fijar search_path en funciones SECURITY DEFINER/trigger
-- para cerrar el hijacking de search_path (advisor function_search_path_mutable).
-- Se pinnea a public (donde viven las tablas) — metadata-only, no cambia el cuerpo.
alter function public.set_tickets_updated_at() set search_path = public;
alter function public.create_default_zone() set search_path = public;
alter function public.increment_category_view(uuid, text) set search_path = public;
