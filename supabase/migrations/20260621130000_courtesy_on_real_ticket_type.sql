-- Cortesía = ticket gratis de una entrada REAL + bandera is_courtesy. Retira el
-- tipo oculto kind='invitation'. La atribución (orders.promoter_link_id) y el
-- precio (orders.total_cents) ya viven en la orden — solo movemos el ticket a una
-- entrada real y lo marcamos. Ver docs/guest-list-refactor.md.

-- 1) Bandera de cortesía en el ticket.
alter table tickets add column if not exists is_courtesy boolean not null default false;

-- 2) Marcar como cortesía los tickets que hoy son de un tipo 'invitation'.
update tickets t
set is_courtesy = true
from ticket_types tt
where t.ticket_type_id = tt.id and tt.kind = 'invitation';

-- 3) Re-apuntar esos tickets a la entrada general real del mismo evento (la más
--    barata; desempata por position). La cortesía reutiliza la entrada real.
with general_target as (
  select distinct on (g.event_id)
    g.event_id, g.id as general_id
  from ticket_types g
  where g.kind = 'general'
  order by g.event_id, g.price_cents asc, g.position asc
)
update tickets t
set ticket_type_id = gt.general_id
from ticket_types inv
join general_target gt on gt.event_id = inv.event_id
where t.ticket_type_id = inv.id
  and inv.kind = 'invitation';

-- 4) Limpiar los tipos 'invitation': los vacíos se borran; los que aún tengan
--    tickets (evento sin general donde re-apuntar) se convierten a 'general'.
delete from ticket_types
where kind = 'invitation'
  and not exists (select 1 from tickets t where t.ticket_type_id = ticket_types.id);
update ticket_types set kind = 'general' where kind = 'invitation';

-- 5) 'sold' = ocupación de aforo: cortesía y venta comparten el cupo físico de la
--    entrada, así que la cortesía SÍ cuenta (no se puede sobrevender el espacio).
--    La separación venta/cortesía para ingresos vive en orders.total_cents.
--    No se toca la definición del trigger (sigue contando todo ticket vigente);
--    se deja el create-or-replace idéntico para documentar la decisión.
create or replace function recompute_ticket_type_sold(p_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  update public.ticket_types tt
  set sold = (
    select count(*)
    from public.tickets t
    join public.orders o on o.id = t.order_id
    where t.ticket_type_id = tt.id
      and t.status in ('active', 'used')
      and t.box_host_ticket_id is null
      and o.status in ('pending', 'paid')
  )
  where tt.id = any(p_ids);
$$;

-- Backfill: reconciliar sold (cortesías re-apuntadas ya cuentan en su general).
update ticket_types tt set sold = (
  select count(*) from tickets t join orders o on o.id = t.order_id
  where t.ticket_type_id = tt.id and t.status in ('active', 'used')
    and t.box_host_ticket_id is null
    and o.status in ('pending', 'paid')
);

-- 6) Restringir kind: ya no existe 'invitation'.
alter table ticket_types drop constraint if exists ticket_types_kind_check;
alter table ticket_types
  add constraint ticket_types_kind_check
  check (kind in ('general', 'box'));
