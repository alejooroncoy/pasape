-- RSVP con aprobación (estilo Luma "Require Approval"), por tipo de entrada.
-- Solo aplica a entradas 100% gratis (price_cents = 0) — combinar aprobación
-- con pago abre una decisión de UX (¿se cobra antes o después de aprobar?)
-- que no hace falta resolver para el caso real: RSVP de eventos gratis.
--
-- Mismo patrón que EventStatus.pending_review: dos valores nuevos en los
-- CHECK existentes de orders/tickets.status, sin tabla nueva.
--   orders.status  += 'pending_approval', 'rejected'
--   tickets.status += 'pending_approval'
--
-- Flujo: buyer completa el checkout normal (gratis) → si el ticket_type
-- exige aprobación, la orden queda 'pending_approval' (no 'paid') y el
-- ticket 'pending_approval' (no 'active', sin QR válido). El organizador
-- aprueba → orden 'paid' + ticket 'active' (ahí se genera el QR). Rechaza →
-- orden 'rejected' + ticket 'void'.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'ticket_types' and column_name = 'requires_approval'
  ) then
    alter table ticket_types add column requires_approval boolean not null default false;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ticket_types_approval_only_free'
  ) then
    alter table ticket_types
      add constraint ticket_types_approval_only_free
      check (not requires_approval or price_cents = 0);
  end if;
end $$;

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending','paid','failed','expired','refunded','pending_approval','rejected'));

alter table tickets drop constraint if exists tickets_status_check;
alter table tickets add constraint tickets_status_check
  check (status in ('active','used','void','refunded','pending_approval'));

comment on column ticket_types.requires_approval is
  'RSVP con aprobación (estilo Luma): el organizador aprueba/rechaza cada inscripción antes de emitir el QR. Solo válido si price_cents = 0.';
