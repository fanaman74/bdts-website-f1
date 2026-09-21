-- Records whether the last verification email was accepted by the mail provider.
--
-- Without this, a provider rejection (unverified sender, wrong API key, quota
-- reached) is invisible from the admin area: the account exists, the message
-- never arrives, and the only clue is a line in the server log.

alter table public.users
  add column verification_last_error text;

comment on column public.users.verification_last_error is
  'Provider rejection message from the last verification email; null when the last attempt was accepted.';
