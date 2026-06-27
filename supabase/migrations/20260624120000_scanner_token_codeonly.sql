-- Auth del portero por CÓDIGO (sin cuenta Google), para la app nativa.
--
-- El portero canjea el código del evento + nombre/DNI, queda ligado al device y
-- recibe un TOKEN opaco (credencial). Las llamadas de la app mandan ese token
-- (header x-door-token); el backend resuelve la sesión por token, sin cookies
-- ni usuario de Supabase Auth. El organizador sigue escaneando por membership.
--
-- Cambios:
--   - profile_id pasa a NULLABLE (el portero por código no tiene profile).
--   - token: credencial opaca del portero (única).
--   - holder_name / dni_last2: identidad capturada en puerta (capa humana).
--   - unique parcial (event_id, device_id) cuando profile_id is null →
--     idempotencia del re-canje en el mismo dispositivo.

alter table scanner_sessions alter column profile_id drop not null;
alter table scanner_sessions add column token text unique;
alter table scanner_sessions add column holder_name text;
alter table scanner_sessions add column dni_last2 text;

create unique index scanner_sessions_codeonly_uq
  on scanner_sessions (event_id, device_id)
  where profile_id is null;
