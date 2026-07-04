-- Cortesías: órdenes S/0 emitidas por el organizador desde el panel (regalos
-- nominativos: cumpleañeros, prensa, auspiciadores). Se distinguen de las
-- órdenes gratis "orgánicas" (entrada liberada gratis que cualquiera toma)
-- para poder listarlas y medirlas por separado.
alter table public.orders
  add column if not exists is_courtesy boolean not null default false;

comment on column public.orders.is_courtesy is
  'true = emitida gratis por el organizador desde el panel (cortesía nominativa), no una compra.';
