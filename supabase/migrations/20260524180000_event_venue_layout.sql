-- Adds venue_layout_url to events.
--
-- Motivación: en el wizard "Crear evento" el organizador sube una imagen de
-- distribución del local (mesas, boxes, zonas, plano de aforo). Esta URL la
-- consume el comprador en la página del evento para decidir su zona/lugar.
-- Es opcional y se llena por separado del cover_url (que sigue siendo el
-- flyer/portada). Compatible hacia atrás: nullable, sin default.

alter table events
  add column venue_layout_url text;
