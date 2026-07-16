-- Rendimiento (auditoría jul 2026): índices de cobertura para 34 foreign keys sin indexar
-- (advisor unindexed_foreign_keys). Sin índice, cada join/filtro por la FK y cada verificación
-- de borrado en la tabla padre hace un scan. Impacto directo en favoritos, vitrina de marca,
-- validación de box en puerta, stats de promotor, reportes de pago y detalle de evento.
-- `if not exists` para reconciliar con el drift remoto <-> migrations sin fallar.

create index if not exists idx_box_members_profile_id on box_members (profile_id);
create index if not exists idx_box_members_ticket_id on box_members (ticket_id);
create index if not exists idx_event_access_codes_zone_id on event_access_codes (zone_id);
create index if not exists idx_event_co_organizers_profile_id on event_co_organizers (profile_id);
create index if not exists idx_event_staff_profile_id on event_staff (profile_id);
create index if not exists idx_events_created_by on events (created_by);
create index if not exists idx_follows_organization_id on follows (organization_id);
create index if not exists idx_holds_buyer_id on holds (buyer_id);
create index if not exists idx_invites_accepted_by on invites (accepted_by);
create index if not exists idx_oauth_authorization_codes_client_id on oauth_authorization_codes (client_id);
create index if not exists idx_oauth_authorization_codes_organization_id on oauth_authorization_codes (organization_id);
create index if not exists idx_oauth_authorization_codes_profile_id on oauth_authorization_codes (profile_id);
create index if not exists idx_oauth_tokens_client_id on oauth_tokens (client_id);
create index if not exists idx_oauth_tokens_organization_id on oauth_tokens (organization_id);
create index if not exists idx_oauth_tokens_profile_id on oauth_tokens (profile_id);
create index if not exists idx_orders_claimed_by on orders (claimed_by);
create index if not exists idx_orders_promoter_link_id on orders (promoter_link_id);
create index if not exists idx_org_promoters_created_by on org_promoters (created_by);
create index if not exists idx_organizations_created_by on organizations (created_by);
create index if not exists idx_organizer_api_keys_created_by on organizer_api_keys (created_by);
create index if not exists idx_payouts_event_id on payouts (event_id);
create index if not exists idx_payouts_paid_by on payouts (paid_by);
create index if not exists idx_payouts_promoter_id on payouts (promoter_id);
create index if not exists idx_promoter_applications_applicant_id on promoter_applications (applicant_id);
create index if not exists idx_promoter_applications_decided_by on promoter_applications (decided_by);
create index if not exists idx_promoter_links_promoter_id on promoter_links (promoter_id);
create index if not exists idx_saved_events_event_id on saved_events (event_id);
create index if not exists idx_scan_events_scanned_by on scan_events (scanned_by);
create index if not exists idx_scanner_sessions_profile_id on scanner_sessions (profile_id);
create index if not exists idx_scanner_sessions_zone_id on scanner_sessions (zone_id);
create index if not exists idx_ticket_recovery_otp_profile_id on ticket_recovery_otp (profile_id);
create index if not exists idx_ticket_transfers_from_profile on ticket_transfers (from_profile);
create index if not exists idx_ticket_transfers_to_profile on ticket_transfers (to_profile);
create index if not exists idx_ticket_types_zone_id on ticket_types (zone_id);
