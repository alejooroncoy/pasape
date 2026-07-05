-- El % del promotor a nivel marca (org_promoters.default_commission_pct) pasa a
-- ser OPCIONAL: null = "hereda de la marca". Así la regla de % de la marca baja
-- en cascada de verdad (link → promotor(null=hereda) → evento → marca).
--
-- Un promotor nuevo nace con null (hereda) en vez de un 15 hardcodeado. Los
-- promotores existentes conservan su valor actual (no se tocan pagos reales).
-- Idempotente.

alter table public.org_promoters alter column default_commission_pct drop default;
alter table public.org_promoters alter column default_commission_pct drop not null;
