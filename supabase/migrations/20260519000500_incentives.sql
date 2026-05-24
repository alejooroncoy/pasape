-- Sub-bounded-context de promoters: metas y recompensas
create table incentives (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  audience        text not null check (audience in ('promoter','buyer')),
  name            text not null,
  goal_kind       text not null
                  check (goal_kind in ('tickets_sold','revenue_cents','tickets_bought','referrals')),
  goal_value      int not null check (goal_value > 0),
  reward          text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index incentives_event_idx on incentives (event_id);

create table incentive_unlocks (
  incentive_id    uuid not null references incentives(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  unlocked_at     timestamptz not null default now(),
  fulfilled_at    timestamptz,
  primary key (incentive_id, profile_id)
);
