-- MVP: venta por WhatsApp para promotores (docs/mvp-whatsapp-promotores-2026-07-21.md).
--
-- Deliberadamente AISLADA del dominio de tickets (ticket_types/orders/tickets):
-- no hay QR de acceso en este MVP porque el organizador (cuando lo hay) ya
-- controla su propia puerta — un QR de Pasape ahí sería decorativo. Lo único
-- que este MVP resuelve es el registro de la venta + comprobante simple, para
-- que el promotor deje de llevar la cuenta a mano y pueda exportarla.

-- Código corto que identifica al promotor en su link de venta
-- (wa.me/<número Pasape>?text=PROMO-<sales_code>). Nullable: solo se asigna
-- cuando el promotor se suma a este canal, no todos los promotores lo tienen.
alter table public.org_promoters
  add column if not exists sales_code text;

create unique index if not exists org_promoters_sales_code_idx
  on public.org_promoters (sales_code)
  where sales_code is not null;

create table if not exists public.whatsapp_sales (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.org_promoters(id) on delete cascade,
  promoter_phone text not null,
  buyer_phone text not null,
  buyer_name text,
  description text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'PEN',
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'rejected')),
  confirmation_code text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists whatsapp_sales_promoter_id_idx on public.whatsapp_sales (promoter_id);
create index if not exists whatsapp_sales_buyer_phone_idx on public.whatsapp_sales (buyer_phone);
create unique index if not exists whatsapp_sales_confirmation_code_idx on public.whatsapp_sales (confirmation_code);

-- CAS atómico de aprobación/rechazo: mismo patrón que approveRegistration en
-- SupabaseTicketRepository (el WHERE status='pending_payment' en el UPDATE, no
-- un check-then-set separado, evita que un doble mensaje del promotor o una
-- carrera aplique dos transiciones sobre la misma venta).
create or replace function confirm_whatsapp_sale(
  p_sale_id uuid,
  p_promoter_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.whatsapp_sales%rowtype;
begin
  update public.whatsapp_sales
  set status = 'paid', paid_at = now()
  where id = p_sale_id
    and promoter_id = p_promoter_id
    and status = 'pending_payment'
  returning * into v_sale;

  if v_sale.id is null then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object('ok', true, 'sale', to_jsonb(v_sale));
end;
$$;

create or replace function reject_whatsapp_sale(
  p_sale_id uuid,
  p_promoter_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.whatsapp_sales%rowtype;
begin
  update public.whatsapp_sales
  set status = 'rejected'
  where id = p_sale_id
    and promoter_id = p_promoter_id
    and status = 'pending_payment'
  returning * into v_sale;

  if v_sale.id is null then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object('ok', true, 'sale', to_jsonb(v_sale));
end;
$$;

revoke all on public.whatsapp_sales from anon, authenticated;
revoke all on function confirm_whatsapp_sale(uuid, uuid) from anon, authenticated;
revoke all on function reject_whatsapp_sale(uuid, uuid) from anon, authenticated;
