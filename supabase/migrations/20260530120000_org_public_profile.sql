-- Vitrina pública de la productora: descripción corta + Instagram.
-- Permiten que la página /[orgSlug] se presente como en Passline/Luma/Eventbrite.
alter table organizations add column if not exists description text;
alter table organizations add column if not exists instagram text; -- handle sin @, ej. "111producciones"
