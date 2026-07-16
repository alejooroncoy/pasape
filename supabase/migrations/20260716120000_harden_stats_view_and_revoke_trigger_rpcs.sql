-- Endurecimiento de seguridad (auditoría jul 2026)
--
-- S3 (ALTO): event_stats_rollup quedó SECURITY DEFINER por drift remoto (reloptions=null
-- en el proyecto en vivo, aunque 20260609110000 la puso en security_invoker=true). Como el
-- owner es postgres (rolbypassrls), la vista saltaba la RLS de events/orders/tickets y `anon`
-- podía leer revenue/sold/capacity/validated de TODAS las organizaciones con solo la
-- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Re-anclamos el flag y revocamos el acceso de cliente:
-- el backend lee estas vistas exclusivamente con service_role (SupabaseEventRepository), que
-- ignora el revoke. Idempotente para reconciliar el drift remoto <-> migrations.

alter view public.event_stats_rollup set (security_invoker = true);
alter view public.event_sales_by_day set (security_invoker = true);

revoke all on public.event_stats_rollup from anon, authenticated;
revoke all on public.event_sales_by_day from anon, authenticated;

-- Funciones TRIGGER internas expuestas por PostgREST como /rest/v1/rpc/<fn>. Postgres otorga
-- EXECUTE a PUBLIC por defecto, así que hay que revocar de PUBLIC (revocar solo de anon/
-- authenticated no basta: el grant a PUBLIC las seguiría dejando ejecutables). No se invocan por
-- RPC desde la app (solo corren como triggers, con los privilegios del owner), así que esto cierra
-- la superficie sin afectar el funcionamiento. NO se tocan las helper de RLS (is_org_staff_read/
-- write, owns_legal_entity): se llaman dentro de las policies.
revoke execute on function public.recompute_ticket_type_sold(uuid[]) from public, anon, authenticated;
revoke execute on function public.sync_sold_on_order() from public, anon, authenticated;
revoke execute on function public.sync_ticket_type_sold() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_tickets_updated_at() from public, anon, authenticated;
revoke execute on function public.create_default_zone() from public, anon, authenticated;
