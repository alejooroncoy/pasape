-- Delta-sync del cache del portero (offline-first): el scanner necesita traer
-- SOLO los tickets que cambiaron desde su último sync, no la lista completa cada
-- vez. Para eso, `updated_at` debe moverse con CUALQUIER acción del ticket
-- (transferencia → current_holder, cambio de datos → holder_*, uso → status/
-- used_at, anulación, firma → signing_pub). Un trigger genérico lo cubre todo;
-- los INSERT (altas/box) ya entran por su default now().
alter table tickets
  add column updated_at timestamptz not null default now();

-- Backfill: que los existentes no salgan todos como "recién cambiados".
update tickets set updated_at = greatest(created_at, coalesce(used_at, created_at));

-- Función propia en public (la estándar de Supabase vive en el schema storage).
create or replace function set_tickets_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger tickets_set_updated_at
  before update on tickets
  for each row execute function set_tickets_updated_at();

-- El delta filtra por updated_at > since.
create index tickets_updated_at_idx on tickets (updated_at);
