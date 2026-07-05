-- Nivel MARCA del esquema de comisión del promotor: la regla base de la
-- organización, que vale para TODOS sus promotores y TODOS sus eventos.
--
-- Es el 4º nivel (el más general) de la cascada de herencia:
--   promotor en el evento (link) → promotor general (org_promoter)
--     → evento (events) → MARCA (organizations, esta migración) → 0
--
-- Mismo shape que los otros niveles: un % por venta + un jsonb de metas
-- ({ basis, milestones }). null = sin regla de marca (cae a 0 / sin metas).
-- Idempotente.

alter table public.organizations
  add column if not exists promoter_commission_pct int,
  add column if not exists promoter_commission_config jsonb;

-- El % vive en [0,100] cuando está seteado (null permitido = sin regla).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_promoter_commission_pct_check'
  ) then
    alter table public.organizations
      add constraint organizations_promoter_commission_pct_check
      check (promoter_commission_pct is null or (promoter_commission_pct >= 0 and promoter_commission_pct <= 100));
  end if;
end $$;
