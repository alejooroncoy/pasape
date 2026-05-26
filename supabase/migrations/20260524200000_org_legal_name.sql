-- Razón social opcional para la productora (RUC/info fiscal).
-- No hay enforcement: dos productoras pueden compartir la misma legal_name
-- si pertenecen al mismo grupo (caso: IN Punta Hermosa con marcas IN, Furtivo, Face).
ALTER TABLE organizations ADD COLUMN legal_name text;
