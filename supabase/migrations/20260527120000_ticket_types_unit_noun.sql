-- Cómo el organizador llama a la unidad reservable: "box", "mesa", "lounge",
-- "espacio" u otro custom. Sirve para que el copy del comprador use la palabra
-- correcta ("Cada mesa para 6 personas" en vez de "Cada box").
-- Default null → el display usa "box".

alter table ticket_types
  add column unit_noun text;
