-- Cupo de cortesías POR PROMOTOR para la lista de invitados.
-- Distinto de promoter_links.quota (tope TOTAL de tickets pagos + gratis que el
-- link puede atribuir). Aquí limitamos solo cuántas CORTESÍAS (tickets is_courtesy)
-- puede repartir ese promotor dentro del cupo total del evento (ticket_types
-- .guest_list_cap). null = sin tope individual (solo lo limita el cupo del evento).
alter table promoter_links
  add column guest_list_quota integer;

alter table promoter_links
  add constraint promoter_links_guest_list_quota_check
  check (guest_list_quota is null or guest_list_quota >= 0);
