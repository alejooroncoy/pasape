-- Cuota opcional por link de promotor.
-- Si es NULL = sin límite (comportamiento actual).
-- Si es un entero positivo = máximo de tickets (pagos + gratis) que ese link puede atribuir.
alter table promoter_links
  add column if not exists quota integer check (quota is null or quota > 0);
