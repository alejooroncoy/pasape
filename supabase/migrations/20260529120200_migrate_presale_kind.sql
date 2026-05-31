-- Retira el kind 'presale'. La preventa pasa a ser atributo de la entrada:
-- cada tier viejo "Preventa" se fusiona dentro de su "General"/"VIP" hermano
-- como (presale_price_cents, presale_qty); luego se elimina y se restringe el
-- CHECK de kind a ('general','vip','box').

-- 1) Fusionar: por cada tier presale, copiar su precio/cupo al hermano del mismo
--    evento (preferir 'general', si no el de mayor capacity entre general/vip).
with chosen as (
  select distinct on (p.id)
    p.id            as presale_id,
    p.price_cents   as presale_price,
    p.capacity      as presale_cap,
    p.presale_ends_at as presale_ends,
    g.id            as target_id
  from ticket_types p
  join ticket_types g
    on g.event_id = p.event_id
   and g.id <> p.id
   and g.kind in ('general', 'vip')
  where p.kind = 'presale'
  order by p.id, (g.kind = 'general') desc, g.capacity desc
)
update ticket_types t
set presale_price_cents = chosen.presale_price,
    presale_qty         = chosen.presale_cap,
    presale_ends_at     = coalesce(t.presale_ends_at, chosen.presale_ends)
from chosen
where t.id = chosen.target_id
  and t.presale_price_cents is null;

-- 2) Eliminar los tiers presale sin ventas (se fusionaron al hermano).
delete from ticket_types
where kind = 'presale' and sold = 0;

-- 3) Los presale con ventas o sin hermano: convertir a entrada normal 'general'
--    (conservan su precio/cupo; no se pierde data ni stock vendido).
update ticket_types set kind = 'general' where kind = 'presale';

-- 4) Restringir el CHECK de kind.
alter table ticket_types drop constraint if exists ticket_types_kind_check;
alter table ticket_types
  add constraint ticket_types_kind_check
  check (kind in ('general', 'vip', 'box'));
