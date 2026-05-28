-- Fecha/hora hasta la que este tipo de entrada está disponible para venta.
-- Null = sin límite (se vende hasta que el evento cierre o se agote).
-- Aplica principalmente a tipo "presale" pero técnicamente a cualquier kind.
alter table ticket_types
  add column sale_ends_at timestamptz;
