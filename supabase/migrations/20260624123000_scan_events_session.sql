-- Trazabilidad de scans para el portero por código (sin cuenta).
--
-- Hoy scan_events.scanned_by es NOT NULL → profiles, pero el portero por código
-- no tiene profile. Se registra entonces por la sesión de portero:
--   - organizador (membership) → scanned_by = su profile.
--   - portero por código        → scanner_session_id = su sesión (scanned_by null).
-- La sesión guarda holder_name/dni_last2 → "quién validó" sigue siendo trazable.

alter table scan_events alter column scanned_by drop not null;
alter table scan_events add column scanner_session_id uuid
  references scanner_sessions(id) on delete set null;

-- Al menos uno de los dos identifica quién escaneó.
alter table scan_events add constraint scan_events_scanner_present
  check (scanned_by is not null or scanner_session_id is not null);

create index scan_events_session_idx on scan_events (scanner_session_id);
