-- Persistir el precio real cobrado por cada ticket (con promos aplicadas) para
-- poder calcular el recaudado POR TIPO de entrada de forma exacta, server-side.
--
-- Antes: solo se guardaba orders.total_cents (el total de la compra). El revenue
-- por tipo se recalculaba en el frontend como precio×vendidos, ignorando
-- preventa/2x1/3x2/cortesías → el desglose no cuadraba con el total real.
--
-- Ahora: cada ticket lleva su parte del subtotal de la línea (subtotal/qty, con
-- el resto asignado al primero). Para boxes, el ticket host lleva el subtotal
-- completo del box; los integrantes que aceptan el invite van con 0.
--
-- Nullable: los tickets históricos no tienen el dato. Se backfillea con el
-- precio del tipo como ESTIMADO (no contemplaba promos pasadas).

alter table tickets add column if not exists price_cents integer;

comment on column tickets.price_cents is
  'Precio real cobrado por este ticket (con promos), en céntimos. NULL/estimado para tickets previos a la migración.';

-- Backfill estimado del histórico: precio activo del tipo al precio normal.
update tickets t
set price_cents = tt.price_cents
from ticket_types tt
where t.ticket_type_id = tt.id
  and t.price_cents is null;
