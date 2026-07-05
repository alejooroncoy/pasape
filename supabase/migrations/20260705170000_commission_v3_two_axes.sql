-- Comisión v3: dos ejes INDEPENDIENTES por promotor —
--   1) commission_pct  → % por venta (ya existente, se queda)
--   2) commission_config→ metas { basis, milestones } (efectivo/especie por umbral)
-- Ambos pueden coexistir (un promotor con 20% Y una botella si mete N que asisten).
-- Se ELIMINA el discriminador commission_type: ya no hay "o % o hitos".
--
-- El organizador elige, por esquema de metas, la BASE del conteo: `sold` (ventas)
-- o `attended` (validados en puerta, gratis+pago; anti-fraude). Ver
-- promoter_attended_units.
--
-- Cambios de shape del jsonb commission_config:
--   v2: { milestones: [{ salesCount, rewardKind: cash|bottle|custom, amountCents, label }] }
--   v3: { basis: "sold", milestones: [{ threshold, rewardKind: cash|perk, amountCents, label }] }
-- salesCount→threshold; bottle/custom→perk; se agrega basis (default "sold").
-- Payment-neutral (auditoría dev): alejandro-5274 conserva sus bonos cash;
-- ALEJO-MAGIA pasa a tener 20% + perks coexistiendo (0 ventas ⇒ neutral hoy).
-- Idempotente + set search_path=''.

-- Helper: migra un jsonb commission_config v2→v3. NULL si no hay milestones.
create or replace function public.__migrate_commission_config_v3(cfg jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when cfg is null or jsonb_typeof(cfg->'milestones') is distinct from 'array' then null
    else jsonb_build_object(
      'basis', coalesce(cfg->>'basis', 'sold'),
      'milestones', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'threshold', coalesce((m->>'threshold')::int, (m->>'salesCount')::int, 0),
            'rewardKind', case when m->>'rewardKind' = 'cash' then 'cash' else 'perk' end,
            'amountCents', case when m->>'rewardKind' = 'cash'
              then coalesce((m->>'amountCents')::int, 0) else null end,
            'label', coalesce(m->>'label', '')
          )
          order by coalesce((m->>'threshold')::int, (m->>'salesCount')::int, 0)
        )
        from jsonb_array_elements(cfg->'milestones') m
      ), '[]'::jsonb)
    )
  end;
$$;

-- 1) Migrar el jsonb en los 3 niveles.
update public.events
  set promoter_commission_config = public.__migrate_commission_config_v3(promoter_commission_config)
  where promoter_commission_config is not null;
update public.org_promoters
  set commission_config = public.__migrate_commission_config_v3(commission_config)
  where commission_config is not null;
update public.promoter_links
  set commission_config_override = public.__migrate_commission_config_v3(commission_config_override)
  where commission_config_override is not null;

drop function public.__migrate_commission_config_v3(jsonb);

-- 2) Bajar el discriminador commission_type (obsoleto) y sus CHECK.
alter table public.org_promoters drop constraint if exists org_promoters_commission_type_check;
alter table public.events drop constraint if exists events_promoter_commission_type_check;
alter table public.promoter_links drop constraint if exists promoter_links_commission_type_check;

alter table public.org_promoters drop column if exists commission_type;
alter table public.events drop column if exists promoter_commission_type;
alter table public.promoter_links drop column if exists commission_type;
