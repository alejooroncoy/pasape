-- Preventa como ATRIBUTO de la entrada (no como kind aparte).
-- presale_price_cents: precio durante la preventa (null = sin preventa).
-- presale_qty: "las primeras N" a precio de preventa (null = sin límite por stock).
--   Se compara contra la columna `sold` existente; no se necesita presale_sold.
-- presale_ends_at: cierre de la preventa por fecha. DISTINTO de sale_ends_at
--   (que cierra la venta del tipo): al terminar la preventa la entrada sigue
--   vendiéndose a price_cents.
alter table ticket_types
  add column presale_price_cents int check (presale_price_cents is null or presale_price_cents >= 0),
  add column presale_qty         int check (presale_qty is null or presale_qty >= 0),
  add column presale_ends_at     timestamptz;
