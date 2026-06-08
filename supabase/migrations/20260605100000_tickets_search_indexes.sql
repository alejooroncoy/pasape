-- Índices para búsqueda rápida en el portero (por nombre y DNI)
-- pg_trgm ya está habilitado (se usa en events.title y events.venue)

-- GIN trigrama para búsqueda de nombre con ilike/like
create index if not exists tickets_holder_name_trgm
  on tickets using gin (holder_name gin_trgm_ops);

-- Btree para búsqueda exacta/prefijo en los últimos 2 dígitos del DNI
create index if not exists tickets_holder_dni_last2_idx
  on tickets (holder_dni_last2);
