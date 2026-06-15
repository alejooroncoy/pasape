-- Set de categorías v2 — validado contra Joinnus/Teleticket/Eventbrite/DICE (jun 2026).
-- Renombra musica→conciertos, absorbe dj_sets+after_office en fiestas, agrega festivales.
alter table events drop constraint if exists events_category_check;

update events set category = 'conciertos' where category = 'musica';
update events set category = 'fiestas'    where category in ('dj_sets', 'after_office');

alter table events
  add constraint events_category_check
  check (category in ('conciertos','fiestas','festivales','comedia','cultura','deportes'));
