-- Publica scan_events y scanner_sessions en Realtime para el dashboard en vivo
-- (accesos al instante, alerta de dup_offline, salud de puertas). La RLS ya
-- restringe la lectura a miembros de la org del evento.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scan_events'
    ) then
      alter publication supabase_realtime add table scan_events;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scanner_sessions'
    ) then
      alter publication supabase_realtime add table scanner_sessions;
    end if;
  end if;
end $$;
