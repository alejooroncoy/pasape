-- L11: PII del libro de reclamaciones cifrada en reposo (AES-256-GCM, DNI_ENC_KEY).

alter table complaint_book
  add column if not exists nombre_enc text,
  add column if not exists numero_documento_enc text,
  add column if not exists domicilio_enc text,
  add column if not exists telefono_enc text,
  add column if not exists email_enc text,
  add column if not exists apoderado_enc text,
  add column if not exists detalle_enc text,
  add column if not exists pedido_enc text,
  add column if not exists respuesta_enc text;

comment on column complaint_book.nombre_enc is 'Nombre cifrado (AES-GCM). Columnas planas legacy — nuevos inserts usan *_enc.';
