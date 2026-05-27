-- Magic-link claim para promotores del pool.
--
-- Cuando el organizador agrega un promotor (o reenvía el invite), generamos un
-- token random single-use. Lo enviamos por WhatsApp como botón URL del template
-- promoter_invite. El promotor tap → /p/[token] → backend valida → asigna
-- profile_id al org_promoter y emite sesión Supabase via verifyOtp magic-link.
--
-- Why: la verificación de negocio Meta sigue pendiente — la categoría
-- Authentication (OTP dedicado) está bloqueada. Magic-link via UTILITY funciona
-- HOY con lo que tenemos aprobado y es el mismo modelo que usan Posh/Luma/Slack
-- para "claim your account".

alter table org_promoters
  add column if not exists claim_token text,
  add column if not exists claim_token_expires_at timestamptz,
  add column if not exists claim_token_used_at timestamptz,
  add column if not exists claim_invite_sent_at timestamptz;

-- Token random URL-safe de 24 bytes (~48 chars hex). El sender lo expone como
-- {{1}} del botón URL del template promoter_invite. Single-use: al claim
-- exitoso se setea claim_token_used_at y se nullea claim_token.
update org_promoters
  set claim_token = encode(gen_random_bytes(24), 'hex'),
      claim_token_expires_at = now() + interval '14 days'
  where claim_token is null
    and profile_id is null
    and deleted_at is null;

-- Lookup rápido del token. Unique parcial: solo cuando hay token activo, así
-- evitamos colisiones imposibles (gen_random_bytes 24 → ~10^-58).
create unique index if not exists org_promoters_claim_token_uidx
  on org_promoters (claim_token)
  where claim_token is not null;

-- Helper: refresca el token (mismo org_promoter, nuevo intento de invite).
-- Útil cuando el organizador hace "reenviar invitación" y el token anterior
-- ya expiró o no recordamos cuál se mandó.
create or replace function refresh_org_promoter_claim_token(p_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  new_token text;
begin
  new_token := encode(gen_random_bytes(24), 'hex');
  update org_promoters
    set claim_token = new_token,
        claim_token_expires_at = now() + interval '14 days',
        claim_token_used_at = null,
        claim_invite_sent_at = now()
    where id = p_id
      and deleted_at is null;
  return new_token;
end;
$$;

revoke all on function refresh_org_promoter_claim_token(uuid) from public;
grant execute on function refresh_org_promoter_claim_token(uuid) to authenticated, service_role;
