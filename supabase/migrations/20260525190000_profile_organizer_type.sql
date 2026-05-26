-- Tipo de perfil del organizador. Se pregunta una vez en el onboarding y
-- personaliza el copy de la app (qué cuelga de qué, qué le llamamos al cliente, etc).
--
-- Valores:
--   production_company  → productora / agencia que organiza para varios clientes
--   venue_owner         → dueño de local / venue
--   independent_host    → anfitrión casual que arma sus propias fiestas

alter table profiles
  add column organizer_type text
    check (organizer_type in ('production_company', 'venue_owner', 'independent_host'));

create index profiles_organizer_type_idx
  on profiles (organizer_type)
  where organizer_type is not null;
