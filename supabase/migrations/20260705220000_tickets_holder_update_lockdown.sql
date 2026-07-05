-- Endurecimiento de RLS: quitar la escritura de cliente sobre `tickets`.
--
-- Agujero (auditoría jul 2026): la policy `tickets_holder_update`
-- (20260519000900_rls.sql:136) era
--   for update using (current_holder = auth_profile_id())
--   with check (current_holder = auth_profile_id());
-- El `with check` solo garantiza que `current_holder` siga siendo el atacante;
-- TODAS las demás columnas de las filas que el titular posee quedaban libremente
-- editables vía PostgREST `PATCH /rest/v1/tickets?id=eq.<propio>`:
--   - status='active' + used_at=null  → re-admisión tras ser escaneado (burla
--     del anti-passback del QR rotativo, una entrada compartida por varios).
--   - transfer_count=0                → burla de transfer_max_count (reventa sin
--     tope).
--   - signing_pub / signing_cert / qr_code / holder_dni_enc / price_cents …
--
-- Ningún flujo legítimo escribe `tickets` desde el cliente: setHolder, transfer,
-- claim y markByQrCode van TODOS por service-role (SupabaseTicketRepository), que
-- bypassa RLS. Por tanto eliminamos la policy de UPDATE de cliente y revocamos el
-- grant de UPDATE por defecto de PostgREST (un revoke por-columna no surtiría
-- efecto mientras exista el grant de tabla).
--
-- Idempotente y con guards de existencia: el proyecto remoto está en drift
-- respecto a supabase/migrations/, así que no asumimos que la tabla/policy exista.

do $$
begin
  if to_regclass('public.tickets') is not null then
    drop policy if exists tickets_holder_update on tickets;
    revoke update on table tickets from anon, authenticated;
  end if;
end $$;
