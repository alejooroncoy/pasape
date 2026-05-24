-- Ticket recovery OTP codes
-- Why: buyers who lost access to their tickets can recover them via a
-- one-time code sent to the phone/email associated with their profile.
-- This is a mock-OTP table for the pilot — codes live for ~10 minutes.
create table ticket_recovery_otp (
  id              uuid primary key default gen_random_uuid(),
  identifier      text not null,        -- phone or email entered by the user
  identifier_kind text not null check (identifier_kind in ('phone','email')),
  profile_id      uuid references profiles(id) on delete cascade,
  code            text not null,        -- 6-digit code
  attempts        int not null default 0,
  consumed_at     timestamptz,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);

create index ticket_recovery_otp_identifier_idx
  on ticket_recovery_otp (identifier, created_at desc);
