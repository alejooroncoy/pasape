-- Lista de invitados: el promotor reparte cortesías (entradas S/0 atribuidas a
-- su link) desde su propia pantalla. Modelamos la cortesía como un ticket_type
-- de kind='invitation', precio 0, oculto en la página pública de compra. El
-- ticket resultante es una "compra gratis" normal (buy:free) atribuida al
-- promotor — misma atribución y mismo flujo de QR que una venta.
alter table ticket_types drop constraint if exists ticket_types_kind_check;
alter table ticket_types
  add constraint ticket_types_kind_check
  check (kind in ('general','vip','box','invitation'));
