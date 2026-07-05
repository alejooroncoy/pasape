-- LOW-13: orders_buyer_insert (20260519000900_rls.sql) solo valida
-- buyer_id = auth_profile_id() en el INSERT — con los grants por defecto de
-- Supabase, un usuario autenticado podía POST /rest/v1/orders con status
-- ='paid', total_cents=0, event_id ajeno, is_courtesy=true, etc. directamente
-- por PostgREST. Todas las órdenes reales se crean server-side con
-- service_role (buy() en SupabaseTicketRepository, que bypassa RLS), así que
-- no hace falta política de INSERT de cliente sobre `orders`.

drop policy if exists orders_buyer_insert on orders;

-- Cierra el hueco por completo: sin policy de insert, RLS ya bloquea el
-- INSERT para authenticated/anon, pero revocamos el grant explícito también
-- (mismo patrón de "revoke explícito" ya usado en el proyecto, coherente con
-- el drift conocido entre remoto y supabase/migrations/).
revoke insert on orders from anon, authenticated;
