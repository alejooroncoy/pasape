-- "Liberar gratis": el organizador suelta una entrada de pago a precio 0,
-- ya sea por una ventana de tiempo o mientras la mantenga activa. Reusa el
-- flujo normal de compra (una entrada gratis es un tipo a precio 0); estos
-- campos solo deciden CUÁNDO el precio efectivo es 0.
--
-- is_free:       toggle del organizador. true = liberada gratis.
-- free_until_at: fin de la liberación por fecha (null = "mientras esté activa";
--                el organizador la apaga a mano). DISTINTO de sale_ends_at y de
--                presale_ends_at.
--
-- El estado vigente (isFreeActive) lo calcula el backend en lectura:
--   is_free AND (free_until_at IS NULL OR free_until_at > now())
-- Sin cron: igual que la preventa, es derivado al mapear.
alter table ticket_types
  add column is_free       boolean not null default false,
  add column free_until_at timestamptz;
