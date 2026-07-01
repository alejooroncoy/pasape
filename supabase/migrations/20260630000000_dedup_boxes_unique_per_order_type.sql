-- Un box es 1 por (order_id, ticket_type_id). La creación perezosa con reintentos
-- generó duplicados (bug del embed ambiguo en loadBox tras añadir orders.claimed_by,
-- que volvió ambigua la relación orders→profiles). Limpiamos conservando el más
-- antiguo y añadimos índice único para que sea imposible duplicar.

delete from box_members bm
using (
  select id from (
    select id,
           row_number() over (partition by order_id, ticket_type_id order by created_at) as rn
    from boxes
  ) x where rn > 1
) dup
where bm.box_id = dup.id;

delete from boxes b
using (
  select id from (
    select id,
           row_number() over (partition by order_id, ticket_type_id order by created_at) as rn
    from boxes
  ) x where rn > 1
) dup
where b.id = dup.id;

create unique index if not exists boxes_order_ticket_type_unique
  on boxes (order_id, ticket_type_id);
