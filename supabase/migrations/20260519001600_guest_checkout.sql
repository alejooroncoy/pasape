-- Guest checkout: el comprador es commodity y no debe loguearse para comprar.
-- Persistimos los datos del invitado en orders y los hooks de notificación
-- (email / WhatsApp) los lee otro agente al despachar el QR.

-- Why: para upsert de profile-by-email cuando es un guest, necesitamos que
-- firebase_uid sea opcional. Los profiles existentes (logueados) seguirán
-- teniendo firebase_uid no nulo gracias a la lógica de aplicación.
alter table profiles alter column firebase_uid drop not null;

-- Why: dos guests no deberían colisionar en una unique key textual; usamos
-- partial unique sobre email cuando hay email para soportar onConflict.
create unique index if not exists profiles_email_unique
  on profiles (lower(email))
  where email is not null;

-- Orders: buyer_id deja de ser obligatorio para soportar compra como invitado.
-- Los datos del guest se persisten en columnas dedicadas para auditoría y para
-- el despacho del QR por email + WhatsApp.
alter table orders alter column buyer_id drop not null;
alter table orders add column if not exists guest_email text;
alter table orders add column if not exists guest_phone text;
alter table orders add column if not exists guest_name  text;
alter table orders add column if not exists guest_dni   text;

create index if not exists orders_guest_email_idx on orders (guest_email);

-- Tickets: copia denormalizada del email/phone del holder para que el QR
-- público (transferencia a un guest) llegue al destinatario sin pasar por
-- profiles.
alter table tickets add column if not exists holder_email text;
alter table tickets add column if not exists holder_phone text;
