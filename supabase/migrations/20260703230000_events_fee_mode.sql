-- El organizador elige, por evento, si la comisión de Pasape se cobra
-- APARTE al comprador (default, comportamiento actual: precio + comisión) o
-- si va INCLUIDA en el precio que puso (el organizador la absorbe, el
-- comprador solo ve un precio final). No cambia cuánto le cobra Mercado
-- Pago a Pasape — solo quién de los dos (comprador u organizador) la paga.
alter table events
  add column if not exists fee_mode text not null default 'buyer_pays_extra'
    check (fee_mode in ('buyer_pays_extra', 'included_in_price'));

comment on column events.fee_mode is
  'buyer_pays_extra: comisión aparte del precio (default). included_in_price: el precio ya la incluye, la absorbe el organizador.';
