-- Señales de comportamiento del checkout para detección anti-bots PROPIA
-- (sin servicios de terceros). Una fila por intento en cada fase del flujo de
-- compra (quote → buy → card → webhook). El backend puntúa cada intento
-- (bot_score) y registra qué acción tomó (action_taken). Arranca en modo
-- 'shadow': se puntúa y registra "qué habría bloqueado" SIN bloquear, para
-- calibrar umbrales contra tráfico real antes de activar fricción.
--
-- Filosofía (política antifraude Pasape): bloquear poco, monitorear en silencio,
-- aprender de la data antes de actuar. Esta tabla es el "monitorear en silencio".
--
-- PRIVACIDAD: NO se guarda PII cruda. El email/teléfono del comprador se guarda
-- como HMAC (contact_hash) — suficiente para correlacionar "N identidades desde
-- el mismo contacto/patrón" sin crear un nuevo almacén de datos personales. El
-- device_hash es un fingerprint no-identificatorio calculado en el cliente.
--
-- ACCESO: tabla exclusivamente server-side (service-role). El browser nunca la
-- lee ni escribe — mismo patrón que scanner_sessions / mp_webhook_events.

create table if not exists purchase_signals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Fase del flujo en la que se capturó la señal.
  phase text not null check (phase in ('quote', 'buy', 'card', 'webhook_paid', 'webhook_failed')),

  -- Contexto de la compra (todos opcionales: quote no crea orden todavía).
  event_id uuid,
  ticket_type_ids uuid[],
  order_id uuid,
  qty int,

  -- Entidades correlacionables (para detectar granjas de scalping).
  ip text,
  user_agent text,
  device_hash text,        -- fingerprint propio del cliente (no identificatorio)
  buyer_id uuid,           -- id interno del profile (placeholder para guest)
  contact_hash text,       -- HMAC del email/teléfono del comprador (no PII cruda)
  dni_hash text,           -- HMAC del DNI (ancla de identidad; anti-multicuentas)
  card_hash text,          -- HMAC de BIN+últimos4+titular (anti-multicuenta por tarjeta)

  -- Señales de comportamiento crudas.
  checkout_token_ok boolean,  -- true=token de sesión válido; false=ausente/inválido (automatización)
  ms_since_mount int,         -- velocidad: ms entre montar la página y la acción (null sin token)

  -- Veredicto del scorer de dominio (botScore).
  bot_score int not null default 0,
  reasons jsonb not null default '[]'::jsonb,   -- ["no_checkout_token","superhuman_speed",...]

  -- Estado del enforcement vigente al registrar y acción efectivamente tomada.
  enforcement_mode text not null default 'shadow'
    check (enforcement_mode in ('shadow', 'soft', 'hard')),
  action_taken text not null default 'logged'
    check (action_taken in ('logged', 'would_block', 'would_throttle', 'throttled', 'blocked'))
);

comment on table purchase_signals is
  'Señales de comportamiento del checkout para detección anti-bots propia. Solo server-side (service-role). Sin PII cruda: email/teléfono como HMAC en contact_hash.';

-- Índices para las agregaciones en ventana que alimentan el scorer: "cuántos
-- intentos desde este device/ip/contacto en los últimos N segundos".
create index if not exists purchase_signals_device_idx on purchase_signals (device_hash, created_at desc);
create index if not exists purchase_signals_ip_idx on purchase_signals (ip, created_at desc);
create index if not exists purchase_signals_contact_idx on purchase_signals (contact_hash, created_at desc);
create index if not exists purchase_signals_dni_idx on purchase_signals (dni_hash, created_at desc);
create index if not exists purchase_signals_card_idx on purchase_signals (card_hash, created_at desc);
create index if not exists purchase_signals_event_idx on purchase_signals (event_id, created_at desc);
create index if not exists purchase_signals_order_idx on purchase_signals (order_id);

-- ── RLS: acceso exclusivamente server-side ──────────────────────────────────
-- Todo el acceso legítimo es por service-role (supabaseAdmin), que bypassa RLS.
-- Revocamos los grants por defecto de PostgREST para que anon/authenticated no
-- puedan leer las señales (revelarían la lógica de detección) ni inyectar filas.
alter table purchase_signals enable row level security;

do $$
begin
  if to_regclass('public.purchase_signals') is not null then
    revoke all on table purchase_signals from anon, authenticated;
  end if;
end $$;
