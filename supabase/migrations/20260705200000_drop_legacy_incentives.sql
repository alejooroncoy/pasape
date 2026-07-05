-- Limpieza: el subsistema viejo de "incentivos" (incentivos al comprador) se
-- eliminó del código en commits anteriores, pero sus tablas quedaron huérfanas
-- (0 filas, sin FKs externas, sin ninguna referencia en el código). Se dropean
-- para no dejar rastro. Idempotente + orden hijo → padre.

drop table if exists public.incentive_unlocks cascade;
drop table if exists public.incentives cascade;
