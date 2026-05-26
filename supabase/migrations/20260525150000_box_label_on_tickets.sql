-- Cada ticket de un box guarda explícitamente a qué box pertenece (A, B, VIP-1, etc.)
-- y quién es el "host" del box (quien lo compró). Los amigos invitados al box reciben
-- su propio QR con box_label idéntico y host = ticket original.
--
-- Modelo: cuando compras un ticket_type kind=box con capacity=8, se crea 1 ticket "host"
-- y 7 plazas vacías; el host comparte un link "invitar al box" que genera tickets para
-- cada amigo con box_host_ticket_id = ticket original y box_label heredado.

alter table ticket_types
  add column box_label text;

alter table tickets
  add column box_label text,
  add column box_host_ticket_id uuid references tickets(id) on delete set null;

create index tickets_box_label_idx
  on tickets (box_label)
  where box_label is not null;

create index tickets_box_host_idx
  on tickets (box_host_ticket_id)
  where box_host_ticket_id is not null;
