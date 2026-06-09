-- Why: los KPIs del panel (vendidas/reservadas/recaudado/validadas) no se
-- refrescaban al instante. En vez de escuchar las tablas vía postgres_changes
-- (lee WAL + RLS por fila → caro), usamos Broadcast desde la DB: un trigger
-- emite un "ping" liviano a un topic por evento y el cliente refetchea el view.
--
-- El payload NO lleva datos de la fila (solo el event_id), así que el topic
-- público no filtra info sensible — el cliente trae los números por la API
-- autenticada (con RLS). Más barato que postgres_changes y la DB sigue siendo
-- la fuente de verdad (no hay que acordarse de emitir desde el código de app).

create or replace function broadcast_event_stats_change() returns trigger
language plpgsql
security definer
as $$
declare
  v_event_id uuid;
begin
  -- orders y scan_events tienen event_id directo.
  v_event_id := coalesce(new.event_id, old.event_id);
  if v_event_id is not null then
    perform realtime.send(
      jsonb_build_object('event_id', v_event_id),
      'stats_changed',
      'event-stats:' || v_event_id::text,
      false  -- topic público: el ping no lleva datos, solo dispara un refetch
    );
  end if;
  return null; -- AFTER trigger: el valor de retorno se ignora
end;
$$;

-- Solo cuando cambia el status de la orden (pending→paid/expired/failed): es
-- lo que mueve vendidas/reservadas/recaudado. Evita ruido por updates triviales.
drop trigger if exists orders_broadcast_stats on orders;
create trigger orders_broadcast_stats
  after insert or update of status on orders
  for each row execute function broadcast_event_stats_change();

-- Cada acceso en puerta mueve "validadas".
drop trigger if exists scan_events_broadcast_stats on scan_events;
create trigger scan_events_broadcast_stats
  after insert on scan_events
  for each row execute function broadcast_event_stats_change();
