-- Agrega "charlas" (Charlas & Networking) al set de categorías v2. Ver
-- 20260613150000_event_category_v2_set.sql para el set original.
alter table events drop constraint if exists events_category_check;

alter table events
  add constraint events_category_check
  check (category in ('conciertos','fiestas','festivales','comedia','cultura','deportes','charlas'));
