-- Nudge proactivo de "pago en revisión + evento inminente": lo dispara pg_cron
-- (no Vercel Cron — este es gratis, sin límite de frecuencia del tier, y
-- consistente con los demás jobs). pg_net hace el HTTP GET al endpoint de Next,
-- que corre la lógica de app (revalidar en MP + notificar).
--
-- SETUP (una vez, fuera de esta migración):
--   1) En Vercel: setear la env CRON_SECRET (un valor secreto cualquiera).
--   2) En Supabase: guardar el MISMO valor en Vault con nombre 'cron_secret':
--        select vault.create_secret('<mismo-valor>', 'cron_secret');
--   Sin ambos, el endpoint responde 401 y el nudge no corre (falla seguro).
--
-- Se agenda cada 3h: la ventana del nudge es 72h, así que sobra. Idempotente:
-- cron.schedule hace upsert por nombre de job.

create extension if not exists pg_net;

select cron.schedule(
  'payment-review-nudge',
  '0 */3 * * *',
  $$
  select net.http_get(
    url := 'https://app.pasape.lat/api/cron/payment-review-nudge',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
        ''
      )
    ),
    timeout_milliseconds := 55000
  );
  $$
);
