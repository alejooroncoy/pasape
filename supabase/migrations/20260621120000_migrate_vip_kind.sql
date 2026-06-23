-- Retira el kind 'vip'. La distinción VIP/General no tiene comportamiento propio:
-- ambas son entradas individuales (1 persona, 1 QR, stock). El NOMBRE ya carga
-- la distinción (el composer escribe "VIP"/"General"/"After" como name). El kind
-- solo debe codificar comportamiento real: 'general' (entrada) | 'box' (espacio)
-- | 'invitation' (cortesía interna). El composer ya solo crea 'general'.

-- 1) Convertir las entradas 'vip' existentes a 'general' (conservan name, precio,
--    cupo y ventas — no se pierde nada; "VIP" sigue en el name).
update ticket_types set kind = 'general' where kind = 'vip';

-- 2) Restringir el CHECK de kind a los kinds con comportamiento real.
alter table ticket_types drop constraint if exists ticket_types_kind_check;
alter table ticket_types
  add constraint ticket_types_kind_check
  check (kind in ('general', 'box', 'invitation'));
