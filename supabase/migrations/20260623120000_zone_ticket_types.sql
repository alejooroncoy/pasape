-- Puertas (zones) N:M con tipos de entrada + puerta principal automática.
--
-- Modelo de cara al organizador ("Puertas"):
--   - Cada evento tiene una "Puerta principal" (is_default) que valida TODAS las
--     entradas. Es un COMODÍN: no necesita filas en zone_ticket_types y el
--     organizador nunca la crea (la pone el trigger).
--   - Las puertas custom seleccionan explícitamente qué ticket_types validan,
--     vía la tabla puente. Una misma entrada puede estar en varias puertas (N:M)
--     — ej. estadio: la puerta Norte valida la entrada Norte; un supervisor en
--     la principal valida todas.
--
-- OJO: ticket_types.zone_id (1:N, legado) NO se usa para validación a partir de
-- aquí; la relación de validación es zone_ticket_types. Se conserva la columna
-- durante la transición; no se dropea aún.

-- 1. Tabla puente N:M puerta ↔ tipo de entrada.
create table zone_ticket_types (
  zone_id        uuid not null references zones(id) on delete cascade,
  ticket_type_id uuid not null references ticket_types(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (zone_id, ticket_type_id)
);

create index zone_ticket_types_tt_idx on zone_ticket_types (ticket_type_id);

alter table zone_ticket_types enable row level security;

-- Mismo criterio que zones/ticket_types: público lee las de eventos publicados;
-- miembros de la org escriben.
create policy zone_ticket_types_public_read on zone_ticket_types
  for select using (
    exists (
      select 1 from zones z join events e on e.id = z.event_id
      where z.id = zone_id
        and (e.status = 'published' or is_org_member(e.organization_id))
    )
  );

create policy zone_ticket_types_member_write on zone_ticket_types
  for all using (
    exists (
      select 1 from zones z join events e on e.id = z.event_id
      where z.id = zone_id and is_org_member(e.organization_id)
    )
  ) with check (
    exists (
      select 1 from zones z join events e on e.id = z.event_id
      where z.id = zone_id and is_org_member(e.organization_id)
    )
  );

-- 2. Puerta principal automática en cada evento nuevo, para que el organizador
--    nunca tenga que crearla (es la base "para todos"; las puertas custom son
--    el caso raro).
create or replace function create_default_zone()
returns trigger language plpgsql as $$
begin
  insert into zones (event_id, name, is_default)
  values (new.id, 'Principal', true)
  on conflict (event_id, name) do nothing;
  return new;
end;
$$;

create trigger events_create_default_zone
  after insert on events
  for each row execute function create_default_zone();

-- 3. Backfill: eventos que hoy no tienen puerta principal → crearla.
insert into zones (event_id, name, is_default)
select e.id, 'Principal', true
from events e
where not exists (
  select 1 from zones z where z.event_id = e.id and z.is_default
)
on conflict (event_id, name) do nothing;
