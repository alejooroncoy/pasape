-- Tope de entradas por persona: el organizador decide, por evento, cuántas
-- entradas puede comprar UNA persona en total (acumulado entre compras). null =
-- sin límite (comportamiento actual). Solo aplica a entradas individuales; los
-- boxes se venden enteros y quedan fuera del tope.
--
-- El backend hace cumplir el acumulado en buy() contando los tickets previos
-- del mismo DNI para el evento (ver SupabaseTicketRepository). priceOrder valida
-- además el tope por orden para dar feedback en el checkout.
alter table events
  add column if not exists max_tickets_per_person int
    check (max_tickets_per_person is null or max_tickets_per_person > 0);

comment on column events.max_tickets_per_person is
  'Máximo de entradas individuales que una persona puede comprar en total para este evento (acumulado por DNI). null = sin límite. Los boxes no cuentan.';
