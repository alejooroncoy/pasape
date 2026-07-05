-- Elimina el subsistema de incentivos viejo. Es redundante con el esquema de
-- comisión del evento (Hitos/Especie del EventSchemeCard), que ya está heredado
-- e integrado en el panel del promotor. Las tablas están vacías en todos los
-- entornos, así que el drop es seguro. CASCADE arrastra las políticas RLS y las
-- FKs. Idempotente por el drift entre remoto y supabase/migrations.
drop table if exists public.incentive_unlocks cascade;
drop table if exists public.incentives cascade;
