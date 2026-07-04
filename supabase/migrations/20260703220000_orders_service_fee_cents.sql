-- Fee de servicio de Pasape (10% por entrada, tope S/15) como columna propia.
-- Antes vivía solo como número hardcodeado en el frontend y nunca se cobraba
-- de verdad (orders.total_cents solo era el subtotal de entradas). Ahora el
-- backend calcula el fee al crear la orden y lo suma a total_cents (lo que
-- realmente se cobra vía MP), guardando el desglose acá para analítica.
alter table orders
  add column if not exists service_fee_cents integer not null default 0;

comment on column orders.service_fee_cents is
  'Comisión de Pasape incluida en total_cents (10% por entrada, tope S/15/entrada). No es parte del subtotal de entradas.';
