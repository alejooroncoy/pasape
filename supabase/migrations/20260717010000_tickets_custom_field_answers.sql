-- Respuestas a las preguntas de registro (event.customFields) por ENTRADA,
-- no por orden. Antes vivían solo en orders.custom_field_answers y se
-- compartían entre todos los tickets de la misma orden (si compras 3, las 3
-- mostraban la misma respuesta, aunque cada una termine con una persona
-- distinta tras transferirse/reclamarse). El comprador sigue respondiendo en
-- el checkout (va al primer ticket); cada persona que reclama una entrada
-- transferida responde lo mismo por su cuenta al canjearla.
alter table tickets
  add column if not exists custom_field_answers jsonb not null default '{}'::jsonb;
