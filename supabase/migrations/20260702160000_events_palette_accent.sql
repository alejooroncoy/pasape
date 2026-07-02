-- El organizador elige (o se le sugiere, extraído del flyer) un único color
-- de acento por evento. El resto de la paleta (tonos oscuro/medio para
-- header, fondo, chips) se deriva de este único hex en tiempo de lectura
-- (ver derivePalette en src/lib/_shared/color.ts) — no se guardan tonos
-- derivados, así el organizador siempre tiene una sola perilla.
alter table events
  add column palette_accent text;
