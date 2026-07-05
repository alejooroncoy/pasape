-- Nudge proactivo de "pago en revisión + evento inminente": lo dispara pg_cron
-- (no Vercel Cron — gratis, sin límite de frecuencia del tier, y consistente con
-- los demás jobs). pg_net hace el HTTP GET al endpoint de Next, que corre la
-- lógica de app (revalidar en MP + notificar).
--
-- Sin secreto: el endpoint es idempotente (cada orden se nudgea a lo sumo una vez
-- vía orders.payment_nudge_sent_at), así que una llamada externa es a lo sumo un
-- no-op. No hace falta CRON_SECRET ni Vault.
--
-- Cada 3h: la ventana del nudge es 72h, así que sobra. Idempotente: cron.schedule
-- hace upsert por nombre de job.
--
-- Aplicar DESPUÉS de que el endpoint esté vivo (si no, el cron pega 404).

create extension if not exists pg_net;

select cron.schedule(
  'payment-review-nudge',
  '0 */3 * * *',
  $$
  select net.http_get(
    url := 'https://app.pasape.lat/api/cron/payment-review-nudge',
    timeout_milliseconds := 55000
  );
  $$
);
