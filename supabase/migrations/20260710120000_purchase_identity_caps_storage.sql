-- Almacenamiento para el cap multi-factor por identidad (contra sobrecompra /
-- multicuenta). Todas las columnas son hashes HMAC no-PII (mismo esquema que
-- purchase_signals): si alguien filtra estos valores, no puede revertirlos ni
-- hacer nada con ellos — no son el email, ni el DNI, ni la tarjeta, solo su
-- huella irreversible. El secreto vive en el server (TICKET_LINK_SECRET).
--
-- Por qué un hash DETERMINISTA nuevo y no reusar holder_dni_enc: el _enc usa IV
-- aleatorio (dos cifrados del mismo DNI dan bytes distintos) — perfecto para
-- reposo, inútil para AGRUPAR/CONTAR por igualdad. El hash determinista permite
-- que el backstop atómico (trigger + CHECK) cuente "cuántas entradas tiene este
-- DNI en el evento" sin descifrar nada.

-- DNI del holder como hash determinista, para contar por identidad en el evento.
alter table tickets add column if not exists holder_dni_hash text;

-- Instrumento de pago (tarjeta / cuenta Yape) como hash, en la orden. Se escriben
-- al pagar (solo se conocen ahí). Son la huella NO-falsificable del pago: cortan
-- "N DNIs con un solo instrumento". Deliberadamente NO guardamos hash de contacto
-- ni cap por cuenta/email: esas dimensiones son falsificables gratis (correos y
-- cuentas desechables) → un tope ahí golpea a familias legítimas sin frenar al
-- revendedor. El anti-abuso se ancla solo en lo no-falsificable (DNI + pago).
alter table orders add column if not exists card_hash text;
alter table orders add column if not exists yape_hash text;

-- Índices para el conteo por identidad dentro de un evento.
create index if not exists tickets_holder_dni_hash_idx
  on tickets (ticket_type_id, holder_dni_hash);
create index if not exists orders_event_card_hash_idx
  on orders (event_id, card_hash);
create index if not exists orders_event_yape_hash_idx
  on orders (event_id, yape_hash);
