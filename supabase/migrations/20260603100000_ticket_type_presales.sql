create table ticket_type_presales (
  id            uuid primary key default gen_random_uuid(),
  ticket_type_id uuid not null references ticket_types(id) on delete cascade,
  price_cents   int not null check (price_cents >= 0),
  ends_at       timestamptz not null,
  position      int not null default 0,
  created_at    timestamptz not null default now()
);

create index ticket_type_presales_tt_idx on ticket_type_presales (ticket_type_id, position);

-- Migrar preventas existentes (columnas legacy) a la nueva tabla
insert into ticket_type_presales (ticket_type_id, price_cents, ends_at, position)
select
  id,
  presale_price_cents,
  coalesce(presale_ends_at, '2099-12-31 23:59:00+00'::timestamptz),
  0
from ticket_types
where presale_price_cents is not null;
