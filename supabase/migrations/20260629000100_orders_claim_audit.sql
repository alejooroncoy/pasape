-- Auditoría del "desbloqueo" de una compra de invitado: quién y cuándo reclamó
-- la orden al entrar con su cuenta (claimOrder). Guardamos el registro además de
-- mover la titularidad de las entradas (decisión de producto: que la info quede).

alter table orders add column if not exists claimed_at timestamptz;
alter table orders add column if not exists claimed_by uuid references profiles(id) on delete set null;
