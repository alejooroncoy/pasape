-- Incentivos solo para PROMOTOR: los incentivos al comprador (audience 'buyer')
-- se descartaron para esta versión. La tabla está vacía en todos los entornos,
-- así que estrechar la constraint es seguro. Idempotente: soporta el drift entre
-- el remoto y supabase/migrations.
do $$
declare
  cname text;
begin
  if to_regclass('public.incentives') is null then
    return; -- la tabla no existe en este entorno; nada que hacer
  end if;

  -- Quitar cualquier check que gobierne `audience` (nombre auto-generado
  -- impredecible según cómo se creó la tabla).
  for cname in
    select conname
    from pg_constraint
    where conrelid = 'public.incentives'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%audience%'
  loop
    execute format('alter table public.incentives drop constraint %I', cname);
  end loop;

  alter table public.incentives
    add constraint incentives_audience_check check (audience in ('promoter'));
end $$;
