-- Transferencias pendientes (reclamo por WhatsApp para no-usuarios).
--
-- El dueño envía una entrada a un número sin cuenta. Se crea una fila
-- `pending` en ticket_transfers con un token aleatorio; al receptor le llega
-- un link /claim/<token> por WhatsApp. Quien abra el link y se loguee se queda
-- con la entrada (posesión del token = credencial, igual que los links de QR).
--
-- El ticket NO cambia de dueño mientras está pending: el emisor lo conserva
-- (y su QR sirve) hasta que el receptor reclame. Al reclamar, current_holder
-- pasa al receptor y la entrada desaparece del wallet del emisor.

-- Vencimiento del link de reclamo (NULL = sin vencer). Lo seteamos al crear.
alter table ticket_transfers
  add column if not exists expires_at timestamptz;

-- Lookup rápido del token al reclamar.
create index if not exists ticket_transfers_pending_token_idx
  on ticket_transfers (pending_token)
  where status = 'pending';

-- A lo sumo UNA transferencia pendiente por ticket. Reenviar/cambiar de
-- destinatario cancela la anterior antes de crear la nueva (en la app).
create unique index if not exists ticket_transfers_one_pending_per_ticket
  on ticket_transfers (ticket_id)
  where status = 'pending';
