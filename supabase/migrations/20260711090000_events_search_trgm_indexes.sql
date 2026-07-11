-- Búsqueda del home (título/lugar con ilike %term%): índices trigram para que
-- el buscador con debounce pegue al backend sin seq-scan. Guards de
-- idempotencia por el drift remoto↔local conocido.
create extension if not exists pg_trgm;

-- Parciales sobre published: es lo único que consulta el buscador público.
create index if not exists idx_events_title_trgm
  on public.events using gin (title gin_trgm_ops)
  where status = 'published';

create index if not exists idx_events_venue_trgm
  on public.events using gin (venue gin_trgm_ops)
  where status = 'published';

-- Orden/paginación del browse público (status + starts_at).
create index if not exists idx_events_published_starts_at
  on public.events (starts_at)
  where status = 'published';
