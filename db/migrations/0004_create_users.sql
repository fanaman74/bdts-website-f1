-- Admin accounts.
--
-- Replaces the single shared password that lived in an environment variable:
-- people now create their own accounts, and each account carries a role.
--
--   pending  just registered — can sign in but sees nothing until approved
--   member   approved staff — may read and triage the submissions inbox
--   admin    may additionally manage accounts and the assistant settings
--
-- A new account is deliberately `pending`: this table guards customer personal
-- data (names, emails, phone numbers, claim details), so self-registration must
-- never be enough to read it.

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text,
  password_hash text not null,
  role text not null default 'pending' check (role in ('admin', 'member', 'pending')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

comment on table public.users is
  'Admin-area accounts. Role pending = registered but not yet approved by an admin.';

create index users_role_created_at_idx
  on public.users (role, created_at desc);
