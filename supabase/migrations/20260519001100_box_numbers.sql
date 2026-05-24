-- Why: the box QR/share screen needs a human-readable identifier
-- ("BOX-1", "BOX-2", …) per event so buyers and friends can talk about
-- "their box" at the venue. We add box_number as nullable text so existing
-- boxes survive the migration; new boxes get assigned at insert time by
-- the repository (count of boxes for the same event + 1).
alter table boxes add column box_number text;

create index if not exists boxes_ticket_type_id_idx on boxes(ticket_type_id);
