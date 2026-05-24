-- Why: commission_tiers y ticket_recovery_otp se manejan exclusivamente desde
-- el backend con service_role. Habilitar RLS sin policies cierra acceso para
-- anon/authenticated; service_role bypassa.
alter table commission_tiers enable row level security;
alter table ticket_recovery_otp enable row level security;
