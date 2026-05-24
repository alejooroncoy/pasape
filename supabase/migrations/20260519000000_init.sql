-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- Profiles: 1 row per Firebase user (firebase_uid = JWT sub)
create table profiles (
  id              uuid primary key default gen_random_uuid(),
  firebase_uid    text unique not null,
  email           text,
  phone           text,
  full_name       text,
  avatar_url      text,
  -- starter hint only; effective role is derived from org_memberships
  initial_role    text not null default 'buyer'
                  check (initial_role in ('buyer','promoter','organizer')),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index profiles_phone_idx on profiles (phone);
create index profiles_email_idx on profiles (email);

-- KYC documents (DNI claro vive separado con RLS estricta)
create table kyc_documents (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  doc_kind        text not null default 'dni' check (doc_kind in ('dni','ce','passport')),
  doc_number      text not null,
  last2           text not null,
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (profile_id, doc_kind)
);

-- OTP throttle (rate limiting de SMS)
create table otp_throttle (
  phone           text not null,
  ip              inet,
  sent_at         timestamptz not null default now()
);
create index otp_throttle_phone_window_idx on otp_throttle (phone, sent_at);

-- Notifications in-app
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  kind            text not null,
  payload         jsonb not null default '{}'::jsonb,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index notifications_profile_unread_idx on notifications (profile_id, read_at);
