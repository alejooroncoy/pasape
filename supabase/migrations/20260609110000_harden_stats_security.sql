-- Endurece los objetos de stats según el advisor de Supabase:
-- 1. Vistas con SECURITY INVOKER → respetan la RLS del usuario que consulta.
--    El backend las lee con service_role (que igual bypassa RLS), así que NO
--    cambia su comportamiento; evita que un usuario autenticado lea por PostgREST
--    los KPIs (sold/revenue) de eventos de otras orgs.
-- 2. search_path fijo en las funciones nuevas (evita secuestro de search_path).
-- 3. Revoca EXECUTE a anon/authenticated en funciones internas (trigger + cron):
--    no deben ser invocables como RPC.

alter view event_stats_rollup set (security_invoker = true);
alter view event_sales_by_day set (security_invoker = true);

-- broadcast: SECURITY DEFINER → search_path bloqueado (refs ya calificadas: realtime.send).
alter function broadcast_event_stats_change() set search_path = '';
-- expire: usa tablas sin calificar → search_path = public.
alter function expire_stale_pending_orders() set search_path = public;

-- Revocar de PUBLIC (anon/authenticated heredan de ahí; revocarles a ellos solos
-- no basta porque el grant por defecto va a PUBLIC). El dueño y el trigger/cron
-- siguen ejecutándolas.
revoke execute on function broadcast_event_stats_change() from public, anon, authenticated;
revoke execute on function expire_stale_pending_orders() from public, anon, authenticated;
