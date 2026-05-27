-- Agrupa ticket_types por zona del venue (ej: "Boxes Premium 1er Piso", "Mesas
-- Premium", "Zona Chivas", "S.VIP"). Coincide con los planos referenciales que
-- los venues publican y permite mostrar la lista agrupada al comprador con
-- headers de sección. Es opcional: si no hay zona, el ticket_type aparece sin
-- agrupar.

alter table ticket_types
  add column zone text;

create index ticket_types_zone_idx
  on ticket_types (event_id, zone)
  where zone is not null;
