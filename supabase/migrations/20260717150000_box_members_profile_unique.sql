-- Tras mover la PK de box_members a (box_id, ticket_id), un mismo profile real
-- podía tomar dos asientos por una carrera en join() (el dedup es
-- read-then-insert, sin lock). Restauramos esa garantía SOLO para miembros con
-- cuenta; los acompañantes sin cuenta (profile_id null) sí pueden repetirse.
create unique index if not exists box_members_box_profile_uidx
  on box_members (box_id, profile_id)
  where profile_id is not null;
