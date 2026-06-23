-- Permite que un promotor sobrescriba el TIPO de comisión en un evento (no solo
-- el % o el config). Junto con commission_pct y commission_config_override, deja
-- personalizar "cómo le pagas" a un promotor en cualquiera de las 3 modalidades.
-- null = hereda el tipo del esquema del evento (y este de la marca).
alter table promoter_links
  add column commission_type text
  check (commission_type is null or commission_type in ('percentage','tiered','inkind'));
