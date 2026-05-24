-- Audit log transversal
create table audit_log (
  id              bigserial primary key,
  actor_id        uuid references profiles(id),
  action          text not null,
  entity          text not null,
  entity_id       text,
  diff            jsonb,
  at              timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log (entity, entity_id);
create index audit_log_actor_idx on audit_log (actor_id, at desc);
