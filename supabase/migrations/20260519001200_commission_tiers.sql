-- Hitos de comisión negociados por promotor.
-- Cada promoter_link puede tener N tiers escalonados.
-- Modelo complementario a "incentives" (que es event-wide).
create table commission_tiers (
  id                 uuid primary key default gen_random_uuid(),
  promoter_link_id   uuid not null references promoter_links(id) on delete cascade,
  threshold_count    int  not null check (threshold_count > 0),
  reward_kind        text not null
                     check (reward_kind in ('cash','bottle','custom')),
  reward_amount_cents int  check (reward_amount_cents is null or reward_amount_cents >= 0),
  reward_label       text not null,
  unlocked_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index commission_tiers_link_idx
  on commission_tiers (promoter_link_id, threshold_count);

-- Un promotor no debería tener dos tiers con el mismo umbral.
create unique index commission_tiers_link_threshold_uq
  on commission_tiers (promoter_link_id, threshold_count);
