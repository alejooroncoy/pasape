-- Antes de este cambio, publish() ponía el evento directo en 'published' y
-- quedaba visible al público sin revisión de Pasape. Ahora el organizador
-- "publica" pero el evento cae en pending_review; Pasape lo aprueba a mano
-- (cambia el status a 'published' desde el Table Editor) mientras no exista
-- panel de staff. events_public_read ya solo expone status='published', así
-- que pending_review no es visible para nadie fuera de la org.
alter table events drop constraint if exists events_status_check;
alter table events add constraint events_status_check
  check (status in ('draft','pending_review','published','closed','cancelled'));
