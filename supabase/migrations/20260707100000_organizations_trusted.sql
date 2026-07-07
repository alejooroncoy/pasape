-- Confianza en el organizador: cuando `trusted = true`, sus eventos saltan
-- la revisión manual de Pasape y publican directo (draft -> published), sin
-- pasar por pending_review. Se activa a mano en el Table Editor por ahora —
-- mismo patrón que la aprobación manual de pending_review (ver
-- 20260706170000_events_pending_review_status.sql). Ver UpdateEvent.ts y
-- SupabaseEventRepository.publish().
alter table organizations
  add column trusted boolean not null default false;
