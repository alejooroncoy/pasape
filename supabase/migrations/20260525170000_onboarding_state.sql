-- Estado de tours de onboarding por usuario.
-- Cada tour se identifica con un slug (ej. "event_panel", "wizard_first_event").
-- Cuando el usuario completa o skipea, se agrega al array.

create table profile_onboarding_state (
  profile_id      uuid primary key references profiles(id) on delete cascade,
  completed_tours text[] not null default '{}',
  updated_at      timestamptz not null default now()
);

alter table profile_onboarding_state enable row level security;

create policy profile_onboarding_self_select on profile_onboarding_state
  for select using (profile_id = auth_profile_id());

create policy profile_onboarding_self_insert on profile_onboarding_state
  for insert with check (profile_id = auth_profile_id());

create policy profile_onboarding_self_update on profile_onboarding_state
  for update using (profile_id = auth_profile_id());
