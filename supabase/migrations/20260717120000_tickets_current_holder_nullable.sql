-- Guest sin usuario: una compra de invitado ya NO crea un profile placeholder
-- (auth.users sintético) solo para poblar current_holder. La identidad real del
-- comprador vive en orders.guest_* y en los campos denormalizados tickets.holder_*;
-- current_holder queda NULL hasta que la persona hace login y reclama su compra
-- (claimOrder lo asigna a la cuenta real). Por eso la columna deja de ser NOT NULL.
--
-- No se migran datos históricos: las órdenes guest anteriores conservan su
-- placeholder (current_holder = profile-guest) y claimOrder sigue soportándolas.
alter table tickets alter column current_holder drop not null;
