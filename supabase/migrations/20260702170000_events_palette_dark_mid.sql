-- Completa la paleta del evento: junto a palette_accent (ya existente),
-- guardamos también los tonos dark/mid extraídos del flyer — la
-- combinación de los 3 es lo que tematiza fondo, header y chips en la
-- página pública del evento (ver derivePalette / extractFlyerPalette).
alter table events
  add column palette_dark text,
  add column palette_mid text;
