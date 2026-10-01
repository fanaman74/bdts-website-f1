-- Email verification for self-registered accounts.
--
-- All nullable on purpose: verification is only *enforced* when a mail provider
-- is configured (see src/lib/email.ts). Without one, registration keeps working
-- and admin approval alone decides access — otherwise a real user who never
-- receives a link could never sign in.

alter table public.users
  add column email_verified_at timestamptz,
  add column verification_token_hash text,
  add column verification_expires_at timestamptz,
  add column verification_sent_at timestamptz;

create index users_verification_token_idx
  on public.users (verification_token_hash)
  where verification_token_hash is not null;

comment on column public.users.verification_token_hash is
  'SHA-256 of the single-use verification token. The raw token only ever exists in the emailed link.';
