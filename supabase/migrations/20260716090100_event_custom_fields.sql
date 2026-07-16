-- Campos personalizados de registro (estilo Luma): el organizador puede pedir
-- datos extra además de nombre/correo al momento de la compra/RSVP
-- ("¿qué universidad?", "¿alergias?", "¿empresa?").
--
-- `events.custom_fields` es la DEFINICIÓN (qué se pregunta), la decide el
-- organizador al crear/editar el evento. `orders.custom_field_answers` es la
-- RESPUESTA del comprador para esa orden puntual. El frontend solo renderiza
-- el formulario a partir de la definición — no inventa validación de negocio,
-- solo la validación de forma que ya hace cualquier input (requerido/tipo).
--
-- Tipos calcados de Luma (Registration Questions → Custom Questions), sin la
-- rama Web3 (ETH/Solana address) que no aplica a Pasape:
--   text | long_text | checkbox | single_select | multiple_select | url | phone
--
-- Shape de custom_fields (array de objetos):
--   [{ "id": "uuid", "label": "¿Qué universidad?", "type": "text",
--      "required": true, "options": ["UPC","PUCP"] }]   -- options solo en *_select
-- Shape de custom_field_answers: { "<field.id>": "respuesta" }

alter table events
  add column if not exists custom_fields jsonb not null default '[]'::jsonb;

comment on column events.custom_fields is
  'Definición de campos extra de registro (estilo Luma), decidida por el organizador. Array de {id,label,type,required,options?}.';

alter table orders
  add column if not exists custom_field_answers jsonb not null default '{}'::jsonb;

comment on column orders.custom_field_answers is
  'Respuestas del comprador a events.custom_fields para esta orden. Keyed por field.id.';
