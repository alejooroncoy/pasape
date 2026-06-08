-- Habilitar pg_cron (extensión de Supabase para jobs programados)
create extension if not exists pg_cron;

-- Auto-cierre de eventos: cuando endsAt ya pasó y el estado sigue en 'published',
-- el sistema cierra el evento automáticamente.
-- El estado es la única fuente de verdad — este job es el que mantiene esa invariante.
select cron.schedule(
  'auto-close-finished-events',
  '0 * * * *',
  $$
    update events
    set status = 'closed'
    where status = 'published'
      and ends_at is not null
      and ends_at < now()
      and deleted_at is null;
  $$
);
