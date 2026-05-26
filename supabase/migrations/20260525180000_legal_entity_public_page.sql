-- Page pública de razón social (hub de marcas).
-- slug: identificador corto público (pasape.pe/p/inpuntahermosa)
-- display_name: nombre "comercial" del grupo ("IN Punta Hermosa"), distinto del legal
-- logo_url, cover_url: branding del hub
-- bio: descripción corta visible en el hub

alter table legal_entities
  add column slug         text,
  add column display_name text,
  add column logo_url     text,
  add column cover_url    text,
  add column bio          text;

create unique index legal_entities_slug_unique
  on legal_entities (slug)
  where slug is not null and deleted_at is null;
