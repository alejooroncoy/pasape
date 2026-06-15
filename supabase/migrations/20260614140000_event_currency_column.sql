-- Moneda a nivel evento (multi-mercado). Antes solo existía en ticket_types;
-- el dominio Event la necesita para formatear montos agregados (recaudado, KPIs)
-- sin depender de un ticket_type. Default PEN; backfill desde los ticket_types
-- del evento cuando exista una moneda distinta.
alter table events add column if not exists currency text not null default 'PEN';

update events e
set currency = sub.currency
from (
  select event_id, min(currency) as currency
  from ticket_types
  where currency is not null
  group by event_id
) sub
where sub.event_id = e.id
  and e.currency = 'PEN'
  and sub.currency is not null
  and sub.currency <> 'PEN';

comment on column events.currency is
  'Moneda del evento (ISO 4217). Default PEN; fuente para formatear montos agregados.';
