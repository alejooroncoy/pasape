-- Lista de invitados configurable por el ORGANIZADOR (FASE 1 / MVP).
-- El organizador activa la lista SOBRE una entrada general real y le pone un cupo
-- total de cortesías. No es un tipo de entrada nuevo: las cortesías siguen siendo
-- tickets gratis (tickets.is_courtesy) sobre esa entrada general. Ver
-- 20260621130000_courtesy_on_real_ticket_type.sql y docs/guest-list-refactor.md.
--
-- guest_list_enabled: la entrada acepta cortesías de la lista del promotor.
-- guest_list_cap:    tope de cortesías (cuenta tickets is_courtesy de esta
--                    entrada). null = sin tope. Validado en UI como <= aforo.

alter table ticket_types
  add column guest_list_enabled boolean not null default false;

alter table ticket_types
  add column guest_list_cap integer;

alter table ticket_types
  add constraint ticket_types_guest_list_cap_check
  check (guest_list_cap is null or guest_list_cap >= 0);
