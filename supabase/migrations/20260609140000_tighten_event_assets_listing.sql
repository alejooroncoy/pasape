-- event-assets es un bucket PÚBLICO: los flyers/logos se sirven por
-- /storage/v1/object/public/... que NO evalúa RLS. La policy SELECT amplia
-- (event_assets_public_read, a PUBLIC, using bucket_id='event-assets') no aporta
-- al acceso por URL — solo habilitaba LISTAR/enumerar todos los archivos del
-- bucket (incluidos eventos no publicados) a cualquiera.
--
-- La app solo usa upload() + getPublicUrl() (nunca .list()), así que la quitamos.
-- Verificado: el objeto público sigue sirviendo 200 tras el drop. Las policies de
-- insert/update (event_assets_auth_insert / event_assets_auth_update) se conservan.
drop policy if exists event_assets_public_read on storage.objects;
