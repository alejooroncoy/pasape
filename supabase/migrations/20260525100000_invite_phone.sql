-- Invites pueden enviarse por correo o por WhatsApp. Agregamos phone (E.164)
-- y aflojamos email para que al menos uno sea requerido a nivel app.
alter table invites add column phone text;

-- Al menos uno: email o phone. Si los dos están vacíos, no se envió por ningún canal
-- y la fila no tiene sentido.
alter table invites
  add constraint invites_email_or_phone
  check (email is not null or phone is not null);
