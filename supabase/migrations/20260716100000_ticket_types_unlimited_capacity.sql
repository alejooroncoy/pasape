-- Entradas ilimitadas: capacity = null significa "sin límite" (eventos
-- virtuales o sin aforo físico). Un box SIEMPRE es finito (asientos reales),
-- así que se agrega un check nuevo que se lo exige solo a boxes — el resto
-- del schema (ticket_types_sold_le_capacity, sold <= capacity) ya tolera
-- capacity null sin cambios: en Postgres cualquier CHECK con NULL se evalúa
-- como "pasa" (unknown, no false).

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'ticket_types' and column_name = 'capacity' and is_nullable = 'NO'
  ) then
    alter table ticket_types alter column capacity drop not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ticket_types_box_capacity_not_null'
  ) then
    alter table ticket_types
      add constraint ticket_types_box_capacity_not_null
      check (kind <> 'box' or capacity is not null);
  end if;
end $$;
