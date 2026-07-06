-- DNI del guest en checkout, cifrado en reposo (mismo esquema que tickets.holder_dni_enc).
--   guest_dni_enc:   AES-256-GCM, clave DNI_ENC_KEY en env.
--   guest_dni_last4: últimos 4 dígitos para búsquedas/display sin exponer el documento.
-- guest_dni (texto plano) queda legacy; el código deja de escribirlo en nuevas órdenes.
alter table orders add column if not exists guest_dni_enc   text;
alter table orders add column if not exists guest_dni_last4 text;
