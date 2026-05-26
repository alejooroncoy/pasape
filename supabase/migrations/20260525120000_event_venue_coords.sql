-- Coords y metadata del venue. El usuario pega un link de Apple/Google Maps y
-- el server extrae nombre + coords. `venue` (texto) sigue siendo el nombre
-- legible; las nuevas columnas son para mostrar mapas/dirigir a maps después.

alter table events add column venue_lat numeric(9, 6);
alter table events add column venue_lng numeric(9, 6);
alter table events add column venue_url text;
alter table events add column venue_source text check (venue_source in ('manual', 'google', 'apple'));
