-- M10: contacto del holder en tickets cifrado en reposo (AES-256-GCM, DNI_ENC_KEY).
--   holder_email_enc / holder_phone_enc: PII cifrada; el server descifra para delivery/export.
-- Columnas planas legacy (holder_email, holder_phone) quedan solo lectura en filas viejas;
-- nuevos inserts escriben null en plano y el valor en *_enc.

alter table tickets add column if not exists holder_email_enc text;
alter table tickets add column if not exists holder_phone_enc text;

comment on column tickets.holder_email_enc is 'Email del holder cifrado (AES-GCM). holder_email legacy solo lectura.';
comment on column tickets.holder_phone_enc is 'Teléfono del holder cifrado (AES-GCM). holder_phone legacy solo lectura.';
