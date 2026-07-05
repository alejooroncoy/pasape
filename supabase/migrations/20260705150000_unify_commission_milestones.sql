-- Unificar los dos mecanismos de comisión del promotor en UN solo modelo:
-- `commission_type ∈ {percentage, milestones}` con hitos en el jsonb
-- `commission_config.milestones`. Baja el Mecanismo 2 (tabla commission_tiers).
--
-- Invariante nuevo: solo hay hitos si type = 'milestones'. "percentage + hitos"
-- deja de ser construible. El desbloqueo NO se persiste: se evalúa al vuelo con
-- computePromoterPayout sobre las entradas vendidas (promoter_sold_units) → un
-- reembolso baja el conteo y el payout retrocede solo, sin premios fantasma.
--
-- Migración de datos (auditoría FASE 0, dev): payment-neutral. El único link con
-- bonos cash desbloqueados (alejandro-5274: S/130 a 3 ventas) se preserva porque
-- portamos la TABLA hacia el jsonb (fuente autoritativa), no al revés.
--
-- Shape del hito: { salesCount, rewardKind: cash|bottle|custom, amountCents, label }.
-- Idempotente + set search_path='' (convención del repo).
--
-- ORDEN: primero se sueltan los CHECK viejos (que rechazarían 'milestones'),
-- luego los updates de datos, luego se re-agregan los CHECK estrechados, y al
-- final se dropea la tabla ya portada.

-- 0) Soltar los CHECK del enum viejo ('percentage','tiered','inkind').
alter table public.org_promoters drop constraint if exists org_promoters_commission_type_check;
alter table public.events drop constraint if exists events_promoter_commission_type_check;
alter table public.promoter_links drop constraint if exists promoter_links_commission_type_check;

-- 1) Portar commission_tiers → promoter_links.commission_config_override (por-link)
--    con type = 'milestones'. Guarded: solo si la tabla aún existe (re-runnable).
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'commission_tiers'
  ) then
    with agg as (
      select
        promoter_link_id,
        jsonb_build_object(
          'milestones',
          jsonb_agg(
            jsonb_build_object(
              'salesCount', threshold_count,
              'rewardKind', reward_kind,
              'amountCents', case when reward_kind = 'cash' then reward_amount_cents else null end,
              'label', coalesce(reward_label, '')
            )
            order by threshold_count
          )
        ) as cfg
      from public.commission_tiers
      group by promoter_link_id
    )
    update public.promoter_links pl
    set commission_type = 'milestones',
        commission_config_override = agg.cfg
    from agg
    where pl.id = agg.promoter_link_id;
  end if;
end $$;

-- 2) Convertir jsonb legacy (inkind = {rewards} / tiered = {tiers}) → {milestones}
--    y type = 'milestones', a nivel EVENTO. Se descartan rewards sin label
--    (placeholders vacíos). 🍾/"bottle" → bottle; el resto → custom.
update public.events e
set promoter_commission_type = 'milestones',
    promoter_commission_config = jsonb_build_object(
      'milestones',
      coalesce((
        select jsonb_agg(m order by (m->>'salesCount')::int)
        from (
          select jsonb_build_object(
            'salesCount', coalesce((r->>'salesCount')::int, 0),
            'rewardKind', case when r->>'icon' in ('🍾', 'bottle') then 'bottle' else 'custom' end,
            'amountCents', null,
            'label', coalesce(r->>'label', '')
          ) as m
          from jsonb_array_elements(e.promoter_commission_config->'rewards') r
          where coalesce(r->>'label', '') <> ''
          union all
          select jsonb_build_object(
            'salesCount', coalesce((t->>'salesCount')::int, 0),
            'rewardKind', 'cash',
            'amountCents', coalesce((t->>'payoutCents')::int, 0),
            'label', ''
          ) as m
          from jsonb_array_elements(e.promoter_commission_config->'tiers') t
        ) x
      ), '[]'::jsonb)
    )
where e.promoter_commission_type in ('inkind', 'tiered');

-- 3) Igual a nivel MARCA (org_promoters).
update public.org_promoters op
set commission_type = 'milestones',
    commission_config = jsonb_build_object(
      'milestones',
      coalesce((
        select jsonb_agg(m order by (m->>'salesCount')::int)
        from (
          select jsonb_build_object(
            'salesCount', coalesce((r->>'salesCount')::int, 0),
            'rewardKind', case when r->>'icon' in ('🍾', 'bottle') then 'bottle' else 'custom' end,
            'amountCents', null,
            'label', coalesce(r->>'label', '')
          ) as m
          from jsonb_array_elements(op.commission_config->'rewards') r
          where coalesce(r->>'label', '') <> ''
          union all
          select jsonb_build_object(
            'salesCount', coalesce((t->>'salesCount')::int, 0),
            'rewardKind', 'cash',
            'amountCents', coalesce((t->>'payoutCents')::int, 0),
            'label', ''
          ) as m
          from jsonb_array_elements(op.commission_config->'tiers') t
        ) x
      ), '[]'::jsonb)
    )
where op.commission_type in ('inkind', 'tiered');

-- 4) Invariante a nivel dato: percentage ⇒ config null (limpia cualquier resto).
update public.events set promoter_commission_config = null
  where promoter_commission_type = 'percentage' and promoter_commission_config is not null;
update public.org_promoters set commission_config = null
  where commission_type = 'percentage' and commission_config is not null;
update public.promoter_links set commission_config_override = null
  where commission_type = 'percentage' and commission_config_override is not null;

-- 5) Re-agregar los CHECK estrechados a ('percentage','milestones').
alter table public.org_promoters
  add constraint org_promoters_commission_type_check
  check (commission_type in ('percentage', 'milestones'));

alter table public.events
  add constraint events_promoter_commission_type_check
  check (promoter_commission_type is null or promoter_commission_type in ('percentage', 'milestones'));

alter table public.promoter_links
  add constraint promoter_links_commission_type_check
  check (commission_type is null or commission_type in ('percentage', 'milestones'));

-- 6) Bajar la tabla del Mecanismo 2 (ya portada). Guarded.
drop table if exists public.commission_tiers;
