-- Libro de Reclamaciones virtual (Ley 29571 / D.S. 011-2011-PCM).
--
-- Registra cada Hoja de Reclamación con un correlativo autoincremental que se
-- muestra al consumidor como constancia (LR-000001). El acceso es exclusivo del
-- service role (la API usa supabaseAdmin) — RLS habilitada y sin políticas para
-- anon/authenticated: nadie puede leer las reclamaciones de otro.

create table if not exists complaint_book (
  id uuid primary key default gen_random_uuid(),
  -- Correlativo legible (constancia). Identidad => monotónico, sin huecos por race.
  correlativo bigint generated always as identity,
  created_at timestamptz not null default now(),

  -- Reclamo | Queja
  tipo text not null check (tipo in ('reclamo', 'queja')),

  -- Consumidor
  nombre text not null,
  tipo_documento text not null check (tipo_documento in ('dni', 'ce', 'pasaporte')),
  numero_documento text not null,
  domicilio text not null,
  telefono text,
  email text not null,
  es_menor_de_edad boolean not null default false,
  apoderado text,

  -- Bien contratado
  tipo_bien text not null check (tipo_bien in ('producto', 'servicio')),
  monto_cents integer,
  descripcion_bien text not null,

  -- Detalle
  detalle text not null,
  pedido text not null,

  -- Gestión del proveedor (respuesta dentro de 15 días hábiles)
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'respondido')),
  respondido_at timestamptz,
  respuesta text
);

comment on table complaint_book is
  'Libro de Reclamaciones virtual (INDECOPI). Solo accesible vía service role.';
comment on column complaint_book.correlativo is
  'Correlativo de la Hoja de Reclamación. Se muestra como constancia: LR-<correlativo>.';

create index if not exists complaint_book_created_at_idx
  on complaint_book (created_at desc);
create index if not exists complaint_book_estado_idx
  on complaint_book (estado)
  where estado = 'pendiente';

alter table complaint_book enable row level security;

-- Sin políticas: anon/authenticated no pueden ver ni escribir. La API valida y
-- escribe con service role. Revoke explícito por el drift remoto↔local conocido.
revoke all on complaint_book from anon, authenticated;
