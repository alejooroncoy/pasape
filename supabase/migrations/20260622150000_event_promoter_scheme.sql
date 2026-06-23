-- Esquema de promotores A NIVEL EVENTO ("así pago y reparto a todos").
-- Tercer nivel entre la marca (org_promoters) y el promotor en el evento
-- (promoter_links). Herencia: link override → esquema del evento → default de
-- la marca. El usuario nunca ve la palabra "herencia"; configura en un solo
-- lugar y personaliza el caso raro en el detalle del promotor.
--
-- Todas las columnas son NULLABLE: null = "usa el default de la marca / sin tope".

alter table events
  add column promoter_commission_pct integer
    check (promoter_commission_pct is null or (promoter_commission_pct >= 0 and promoter_commission_pct <= 100)),
  add column promoter_commission_type text
    check (promoter_commission_type is null or promoter_commission_type in ('percentage','tiered','inkind')),
  add column promoter_commission_config jsonb,
  add column promoter_default_quota integer
    check (promoter_default_quota is null or promoter_default_quota > 0),
  add column promoter_default_guest_list_quota integer
    check (promoter_default_guest_list_quota is null or promoter_default_guest_list_quota >= 0);

-- commission_pct del link pasa a NULLABLE: null = el link no tiene comisión
-- propia, hereda del esquema del evento (y este de la marca). Los links
-- existentes conservan su valor (se tratan como personalización explícita).
alter table promoter_links
  alter column commission_pct drop not null;
