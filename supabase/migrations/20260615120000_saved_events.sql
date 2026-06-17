-- Eventos guardados por el usuario (wishlist / "me gusta").
-- Estructura espejo de `follows`: clave compuesta + RLS self-scoped.
create table saved_events (
  user_id    uuid not null references profiles(id) on delete cascade,
  event_id   uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- Para listar rápido "mis guardados" ordenados por recientes.
create index saved_events_user_created_idx on saved_events (user_id, created_at desc);

alter table saved_events enable row level security;

-- El usuario solo ve y gestiona sus propios guardados.
create policy saved_events_self on saved_events
  for all using (user_id = auth_profile_id())
  with check (user_id = auth_profile_id());
