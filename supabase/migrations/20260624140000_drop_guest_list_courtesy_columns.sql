-- Se eliminó la feature de "lista de invitados" de promotor + el concepto
-- "cortesía" (is_courtesy). Lo gratis es ahora simplemente una entrada a
-- precio 0 (el flujo normal de compra la cobra a 0; el reporte separa gratis
-- vs venta por orders.total_cents, no por un flag). Estas columnas quedaron
-- sin uso en el código (0 referencias) y sin dependencias en la BD (ningún
-- índice/vista/trigger/función las referencia).
alter table tickets        drop column if exists is_courtesy;
alter table ticket_types   drop column if exists guest_list_enabled;
alter table ticket_types   drop column if exists guest_list_cap;
alter table promoter_links drop column if exists guest_list_quota;
alter table events         drop column if exists promoter_default_guest_list_quota;
