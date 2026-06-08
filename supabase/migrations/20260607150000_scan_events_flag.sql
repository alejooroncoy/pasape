-- Flag de detección de doble-ingreso offline en el log de scans.
--
-- Cuando dos puertas offline (sin coordinador BLE) validan el mismo ticket, al
-- sincronizar el segundo scan se detecta el `valid` previo y se marca
-- 'dup_offline' en vez de fallar silencioso. El dashboard alerta sobre esto.

alter table scan_events
  add column flag text not null default 'ok'
  check (flag in ('ok', 'dup_offline'));

-- Índice parcial para detectar rápido el mismo ticket con >=2 scans 'valid'
-- (un ingreso legítimo deja exactamente uno).
create index scan_events_valid_ticket_idx
  on scan_events (ticket_id)
  where result = 'valid';
