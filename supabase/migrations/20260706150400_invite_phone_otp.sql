-- Invites por WhatsApp (solo phone, sin email) hoy se aceptan con cualquier
-- cuenta de Google que tenga el link — el token es la única prueba de
-- posesión. Para elevar la barra, se agrega verificación OTP del teléfono:
-- el invitado debe confirmar que es dueño del número antes de que
-- acceptInvite() le asigne membership.

alter table invites add column phone_verified_at timestamptz;
alter table invites add column otp_send_count int not null default 0;
alter table invites add column otp_last_sent_at timestamptz;
alter table invites add column otp_attempts int not null default 0;
