-- Agrega scope_type='event' a invites: invitar a alguien como co-organizador
-- de UN evento puntual (tabla event_co_organizers en la aceptación), sin
-- volverlo miembro de la marca. Ver AcceptInvite.ts.
alter table invites drop constraint if exists invites_scope_type_check;
alter table invites add constraint invites_scope_type_check
  check (scope_type in ('portfolio','legal_entity','organization','event'));
