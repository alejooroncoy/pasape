-- Caso 2 "guest sin usuario" en boxes: un acompañante de box SIN celular ya no
-- necesita un profile placeholder (auth.users sintético). Su QR lo lleva el HOST
-- (tickets.current_holder = dueño del box) y su nombre vive en
-- tickets.holder_name; el asiento se identifica por su TICKET, no por un profile.
-- Por eso la identidad del miembro pasa de profile_id a ticket_id.
do $$
begin
  -- Primero soltamos la PK vieja (box_id, profile_id): Postgres no deja quitar
  -- NOT NULL de una columna que forma parte de la primary key.
  if exists (select 1 from pg_constraint where conname = 'box_members_pkey') then
    alter table box_members drop constraint box_members_pkey;
  end if;

  -- profile_id deja de ser obligatorio: el acompañante sin cuenta no tiene uno.
  alter table box_members alter column profile_id drop not null;

  -- La identidad del asiento es su ticket. Filas legacy sin ticket no deberían
  -- existir (los 3 caminos de alta —host, join, companion— siempre emiten un
  -- ticket); si las hubiera, se descartan para poder fijar la nueva PK.
  delete from box_members where ticket_id is null;
  alter table box_members alter column ticket_id set not null;

  -- Nueva PK (box_id, ticket_id): ticket_id es único por asiento, así que no
  -- admite duplicados y sigue sirviendo a la idempotencia del alta del host
  -- (onConflict box_id,ticket_id).
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'box_members'::regclass and contype = 'p'
  ) then
    alter table box_members add primary key (box_id, ticket_id);
  end if;
end $$;
