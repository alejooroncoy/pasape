-- Insignia pública de "organizador verificado" (curada por Pasape).
-- Distinta de `trusted`, que es la señal interna antifraude — esta es la que se
-- muestra al público junto al nombre de la productora en el detalle del evento.
-- Idempotente por el drift remoto↔local: se aplicó primero vía MCP en prod.
alter table public.organizations
  add column if not exists verified boolean not null default false;

comment on column public.organizations.verified is
  'Insignia pública de organizador verificado (curada por Pasape). Distinta de trusted, que es la señal interna antifraude.';
